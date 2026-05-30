#[test_only]
module sealed_pair::order_tests;

use sealed_pair::order::{Self as so, Order};
use sui::clock;
use sui::coin;
use sui::object;
use sui::sui::SUI;
use sui::test_scenario as ts;
use sui::test_utils::destroy;

const MAKER: address = @0xA11CE;
const TAKER: address = @0xB0B;

fun fake_policy_id(): object::ID { object::id_from_address(@0xDEAD) }

#[test]
fun create_and_lock_then_reveal_settle() {
    let mut scenario = ts::begin(MAKER);
    let mut clock = clock::create_for_testing(scenario.ctx());

    // create_offer (maker)
    so::create_offer(
        b"bafyk0001", fake_policy_id(),
        b"SUI", b"USDC",
        1_000_000_000, // 1 SUI escrow
        10,            // expiry epoch
        scenario.ctx(),
    );

    // taker session: fund escrow
    scenario.next_tx(TAKER);
    let mut order = scenario.take_shared<Order>();
    let payment = coin::mint_for_testing<SUI>(1_000_000_000, scenario.ctx());
    so::lock_with_escrow(&mut order, payment, &clock, scenario.ctx());
    assert!(so::is_locked(&order), 1);
    assert!(so::escrow_value(&order) == 1_000_000_000, 2);

    // maker marks revealed
    scenario.next_tx(MAKER);
    so::mark_revealed(&mut order, scenario.ctx());
    assert!(so::is_revealed(&order), 3);

    // maker settles — escrow goes back to maker
    so::settle(&mut order, scenario.ctx());
    assert!(so::is_settled(&order), 4);
    assert!(so::escrow_value(&order) == 0, 5);

    ts::return_shared(order);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
#[expected_failure(abort_code = 1, location = sealed_pair::order)]
fun lock_with_wrong_escrow_amount_aborts() {
    let mut scenario = ts::begin(MAKER);
    let clock = clock::create_for_testing(scenario.ctx());

    so::create_offer(
        b"bafyk0002", fake_policy_id(),
        b"SUI", b"USDC",
        1_000_000_000, 10,
        scenario.ctx(),
    );

    scenario.next_tx(TAKER);
    let mut order = scenario.take_shared<Order>();
    let underpaid = coin::mint_for_testing<SUI>(500_000_000, scenario.ctx());
    so::lock_with_escrow(&mut order, underpaid, &clock, scenario.ctx());

    ts::return_shared(order);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}

#[test]
fun maker_cancels_open_quote() {
    let mut scenario = ts::begin(MAKER);
    so::create_offer(
        b"bafyk0003", fake_policy_id(),
        b"SUI", b"USDC",
        1_000_000_000, 10,
        scenario.ctx(),
    );

    scenario.next_tx(MAKER);
    let mut order = scenario.take_shared<Order>();
    so::cancel_open(&mut order, scenario.ctx());

    ts::return_shared(order);
    ts::end(scenario);
}

#[test]
fun seal_approve_policy_is_strict() {
    let mut scenario = ts::begin(MAKER);
    let clock = clock::create_for_testing(scenario.ctx());

    // Step 1: OPEN — seal_approve must be false (no escrow yet).
    so::create_offer(
        b"bafyk_seal", fake_policy_id(),
        b"SUI", b"USDC",
        1_000_000_000, 10,
        scenario.ctx(),
    );
    scenario.next_tx(MAKER);
    let mut order = scenario.take_shared<Order>();
    assert!(!so::seal_approve(&order, MAKER, scenario.ctx()), 100);
    assert!(!so::seal_approve(&order, TAKER, scenario.ctx()), 101);

    // Step 2: LOCKED with funded escrow — seal_approve must be true for both parties.
    scenario.next_tx(TAKER);
    let payment = coin::mint_for_testing<SUI>(1_000_000_000, scenario.ctx());
    so::lock_with_escrow(&mut order, payment, &clock, scenario.ctx());
    assert!(so::seal_approve(&order, MAKER, scenario.ctx()), 102);
    assert!(so::seal_approve(&order, TAKER, scenario.ctx()), 103);

    // Step 3: third-party requester must still be rejected.
    assert!(!so::seal_approve(&order, @0xC0DE, scenario.ctx()), 104);

    ts::return_shared(order);
    clock::destroy_for_testing(clock);
    ts::end(scenario);
}
