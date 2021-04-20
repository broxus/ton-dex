pragma ton-solidity ^0.39.0;

interface IDexRoot {
    event AccountCodeUpgraded(uint32 version);
    event PairCodeUpgraded(uint32 version);
    event RootCodeUpgraded();
    event ActiveUpdated(bool new_active);

    event RequestedPairUpgrade(address left_root, address right_root);
    event RequestedForceAccountUpgrade(address account_owner);

    event RequestedOwnerTransfer(address old_owner, address new_owner);
    event OwnerTransferAccepted(address old_owner, address new_owner);

    event NewPairCreated(address left_root, address right_root);

    function requestUpgradeAccount(uint32 current_version, address send_gas_to, address owner) external;
    function onPairCreated(address left_root, address right_root, address send_gas_to) external;
}
