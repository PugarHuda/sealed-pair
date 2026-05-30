/// Sealed Pair — sealed peer-to-peer OTC trades on Sui.
///
/// State machine:
///   OPEN  --(taker funds escrow)-->  LOCKED
///   LOCKED --(off-chain Seal reveal)--> REVEALED
///   REVEALED --(both confirm, atomic PTB)--> SETTLED
///   OPEN | LOCKED --(maker cancel / expiry)--> CANCELLED
///
/// V1 keeps the escrow asset hardcoded to `SUI`. V2 will go generic on Coin<T>.
module sealed_pair::order;

use std::ascii::{Self, String};
use sui::balance::{Self, Balance};
use sui::clock::{Self, Clock};
use sui::coin::{Self, Coin};
use sui::event;
use sui::object::{Self, ID, UID};
use sui::sui::SUI;
use sui::transfer;
use sui::tx_context::{Self, TxContext};

// ============ state constants ============
const STATE_OPEN: u8       = 0;
const STATE_LOCKED: u8     = 1;
const STATE_REVEALED: u8   = 2;
const STATE_SETTLED: u8    = 3;
const STATE_CANCELLED: u8  = 4;

// ============ error codes ============
const EWrongState: u64         = 0;
const EWrongEscrowAmount: u64  = 1;
const ENotAuthorized: u64      = 2;
const EExpired: u64            = 3;
const ENotExpired: u64         = 4;
const ENoTakerYet: u64         = 5;

// ============ the Order object ============
public struct Order has key, store {
    id: UID,
    /// Quote owner — receives settlement proceeds.
    maker: address,
    /// Counterparty — set when escrow is funded.
    taker: Option<address>,
    /// Walrus blobId of the encrypted terms (content-addressed commitment).
    blob_id: vector<u8>,
    /// Seal policy object id (placeholder — wired when Seal SDK lands).
    policy_id: ID,
    /// Which asset the maker delivers, e.g. b"SUI".
    give_kind: String,
    /// Which asset the taker delivers, e.g. b"USDC".
    get_kind: String,
    /// Lifecycle marker (see STATE_* constants).
    state: u8,
    /// Sui epoch after which the order auto-expires.
    expiry_epoch: u64,
    /// Required escrow size, in MIST.
    escrow_required: u64,
    /// Actual escrow held in the object until settle / cancel.
    escrow: Balance<SUI>,
    /// Sui epoch at creation, useful for analytics.
    created_at_epoch: u64,
}

// ============ events ============
public struct OrderPosted has copy, drop {
    order_id: ID,
    maker: address,
    blob_id: vector<u8>,
    give_kind: String,
    get_kind: String,
    escrow_required: u64,
    expiry_epoch: u64,
}

public struct OrderLocked has copy, drop {
    order_id: ID,
    taker: address,
    escrow_amount: u64,
}

public struct OrderRevealed has copy, drop {
    order_id: ID,
}

public struct OrderSettled has copy, drop {
    order_id: ID,
    settled_at_epoch: u64,
}

public struct OrderCancelled has copy, drop {
    order_id: ID,
    /// 0 = maker withdrew while OPEN; 1 = expiry triggered.
    reason: u8,
}

// ============ create ============
/// Post a sealed quote. The blob id is the Walrus commitment to the encrypted terms.
///
/// Note: we share the Order so any future taker can discover + fund escrow.
public entry fun create_offer(
    blob_id: vector<u8>,
    policy_id: ID,
    give_kind: vector<u8>,
    get_kind: vector<u8>,
    escrow_required: u64,
    expiry_epoch: u64,
    ctx: &mut TxContext,
) {
    let order = Order {
        id: object::new(ctx),
        maker: tx_context::sender(ctx),
        taker: option::none(),
        blob_id,
        policy_id,
        give_kind: ascii::string(give_kind),
        get_kind: ascii::string(get_kind),
        state: STATE_OPEN,
        expiry_epoch,
        escrow_required,
        escrow: balance::zero<SUI>(),
        created_at_epoch: tx_context::epoch(ctx),
    };

    event::emit(OrderPosted {
        order_id: object::id(&order),
        maker: order.maker,
        blob_id: order.blob_id,
        give_kind: order.give_kind,
        get_kind: order.get_kind,
        escrow_required: order.escrow_required,
        expiry_epoch: order.expiry_epoch,
    });

    transfer::share_object(order);
}

// ============ lock with escrow ============
/// Taker funds escrow to satisfy the Seal policy, transitioning OPEN -> LOCKED.
/// The deposited Coin<SUI> must exactly match `escrow_required`.
public entry fun lock_with_escrow(
    order: &mut Order,
    payment: Coin<SUI>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    assert!(order.state == STATE_OPEN, EWrongState);
    // Sui Clock is monotonic ms; we compare epoch via tx context.
    let _now_ms = clock::timestamp_ms(clock);
    assert!(tx_context::epoch(ctx) < order.expiry_epoch, EExpired);

    let amount = coin::value(&payment);
    assert!(amount == order.escrow_required, EWrongEscrowAmount);

    let taker_addr = tx_context::sender(ctx);
    balance::join(&mut order.escrow, coin::into_balance(payment));
    order.taker = option::some(taker_addr);
    order.state = STATE_LOCKED;

    event::emit(OrderLocked {
        order_id: object::id(order),
        taker: taker_addr,
        escrow_amount: amount,
    });
}

// ============ mark revealed ============
/// Off-chain Seal released the key; either party signals that on-chain so
/// indexers and the settle step can advance. State transitions LOCKED -> REVEALED.
public entry fun mark_revealed(order: &mut Order, ctx: &mut TxContext) {
    assert!(order.state == STATE_LOCKED, EWrongState);
    let sender = tx_context::sender(ctx);
    assert!(is_party(order, sender), ENotAuthorized);

    order.state = STATE_REVEALED;
    event::emit(OrderRevealed { order_id: object::id(order) });
}

// ============ settle ============
/// Atomic settlement: hand the escrow over to the maker as the agreed payment.
/// V1 is escrow-only — V2 will accept a maker `Coin<GIVE>` to atomically swap.
public entry fun settle(order: &mut Order, ctx: &mut TxContext) {
    assert!(order.state == STATE_REVEALED, EWrongState);
    let sender = tx_context::sender(ctx);
    assert!(is_party(order, sender), ENotAuthorized);

    let amount = balance::value(&order.escrow);
    let proceeds = coin::from_balance(balance::split(&mut order.escrow, amount), ctx);
    transfer::public_transfer(proceeds, order.maker);

    order.state = STATE_SETTLED;
    event::emit(OrderSettled {
        order_id: object::id(order),
        settled_at_epoch: tx_context::epoch(ctx),
    });
}

// ============ cancellation paths ============
/// Maker withdraws an OPEN quote. No escrow has been posted yet.
public entry fun cancel_open(order: &mut Order, ctx: &mut TxContext) {
    assert!(order.state == STATE_OPEN, EWrongState);
    assert!(tx_context::sender(ctx) == order.maker, ENotAuthorized);

    order.state = STATE_CANCELLED;
    event::emit(OrderCancelled { order_id: object::id(order), reason: 0 });
}

/// Anyone can trigger expiry cleanup after the deadline. If the order was
/// LOCKED, escrow returns to the taker.
public entry fun cancel_expired(order: &mut Order, ctx: &mut TxContext) {
    assert!(tx_context::epoch(ctx) >= order.expiry_epoch, ENotExpired);
    assert!(
        order.state == STATE_OPEN || order.state == STATE_LOCKED,
        EWrongState,
    );

    if (order.state == STATE_LOCKED) {
        assert!(option::is_some(&order.taker), ENoTakerYet);
        let taker_addr = *option::borrow(&order.taker);
        let amount = balance::value(&order.escrow);
        if (amount > 0) {
            let refund = coin::from_balance(balance::split(&mut order.escrow, amount), ctx);
            transfer::public_transfer(refund, taker_addr);
        };
    };

    order.state = STATE_CANCELLED;
    event::emit(OrderCancelled { order_id: object::id(order), reason: 1 });
}

// ============ Seal access policy ============
/// Identity-based access policy callable by Sui Seal key servers.
/// Returns `true` only when the on-chain conditions for releasing the
/// decryption key share are met. The Seal SDK runs a PTB that invokes
/// this function before handing the key over to the requester.
///
/// Policy:
///   - The order is past the OPEN gate (escrow has been funded at some point), AND
///   - The requester must be either the maker or the taker, AND
///   - The current epoch must be before the order expiry.
///
/// Once an order transitions LOCKED -> REVEALED -> SETTLED, parties retain
/// key access so the audit trail can re-decrypt the original ciphertext
/// from Walrus after the fact (judges verifying historic settlements,
/// regulatory audit, etc.). Only OPEN (no taker yet) and CANCELLED
/// (refunded, terms no longer relevant) deny access.
public fun seal_approve(order: &Order, requester: address, ctx: &TxContext): bool {
    let state_ok = order.state == STATE_LOCKED
        || order.state == STATE_REVEALED
        || order.state == STATE_SETTLED;
    state_ok
        && is_party(order, requester)
        && tx_context::epoch(ctx) < order.expiry_epoch
}

// ============ read helpers (free, for off-chain decoding) ============
public fun maker(order: &Order): address { order.maker }
public fun taker(order: &Order): Option<address> { order.taker }
public fun blob_id(order: &Order): vector<u8> { order.blob_id }
public fun policy_id(order: &Order): ID { order.policy_id }
public fun state(order: &Order): u8 { order.state }
public fun is_open(order: &Order): bool { order.state == STATE_OPEN }
public fun is_locked(order: &Order): bool { order.state == STATE_LOCKED }
public fun is_revealed(order: &Order): bool { order.state == STATE_REVEALED }
public fun is_settled(order: &Order): bool { order.state == STATE_SETTLED }
public fun expiry_epoch(order: &Order): u64 { order.expiry_epoch }
public fun escrow_required(order: &Order): u64 { order.escrow_required }
public fun escrow_value(order: &Order): u64 { balance::value(&order.escrow) }

fun is_party(order: &Order, who: address): bool {
    if (who == order.maker) return true;
    if (option::is_some(&order.taker)) {
        return *option::borrow(&order.taker) == who
    };
    false
}
