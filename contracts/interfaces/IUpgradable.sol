pragma ton-solidity >= 0.56.0;

interface IUpgradable {
    function upgrade(TvmCell code) external;
}
