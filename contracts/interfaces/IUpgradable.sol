pragma ton-solidity >= 0.57.0;

interface IUpgradable {
    function upgrade(TvmCell code) external;
}
