pragma ton-solidity >= 0.39.0;

interface IUpgradable {
    function upgrade(TvmCell code) external;
}
