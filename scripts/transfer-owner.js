const {Migration, afterRun} = require(process.cwd() + '/scripts/utils')

const submitTransactionAcceptOwner = async (account, target, keyPair) => {
  return await account.run({
    method: 'submitTransaction',
    params: {
      dest: target.address,
      value: locklift.utils.convertCrystal(0.5, 'nano'),
      bounce: true,
      allBalance: false,
      payload: (await this.locklift.ton.client.abi.encode_message_body({
        address: target.address,
        abi: {
          type: "Contract",
          value: target.abi,
        },
        call_set: {
          function_name: 'acceptOwner',
          input: {},
        },
        signer: {
          type: 'None',
        },
        is_internal: true,
      })).body
    },
    keyPair
  });
}

async function main() {
  const migration = new Migration();
  const keyPairs = await locklift.keys.getKeyPairs();
  const oldOwner = migration.load(await locklift.factory.getAccount('Wallet'), 'Account1');
  oldOwner.afterRun = afterRun;
  const Msig = await locklift.factory.getContract('SafeMultisigWallet', 'safemultisig');
  const newOwner = migration.load(Msig, 'NewOwnerMsig');
  newOwner.afterRun = afterRun;
  const dexRoot = migration.load(await locklift.factory.getContract('DexRoot'), 'DexRoot');
  const dexVault = migration.load(await locklift.factory.getContract('DexVault'), 'DexVault');
  const tokenFactory = migration.load(await locklift.factory.getContract('TokenFactory'), 'TokenFactory');
  console.log(`Transferring DEX ownership from ${oldOwner.address} to ${newOwner.address}`);
  console.log(`Transfer for DexRoot: ${dexRoot.address}`);
  await oldOwner.runTarget({
    contract: dexRoot,
    method: 'transferOwner',
    params: {new_owner: newOwner.address},
    value: locklift.utils.convertCrystal(1, 'nano'),
    keyPair: keyPairs[0]
  });
  console.log(`Transfer for DexVault: ${dexVault.address}`);
  await oldOwner.runTarget({
    contract: dexVault,
    method: 'transferOwner',
    params: {new_owner: newOwner.address},
    value: locklift.utils.convertCrystal(1, 'nano'),
    keyPair: keyPairs[0]
  });
  console.log(`Transfer for TokenFactory: ${tokenFactory.address}`);
  await oldOwner.runTarget({
    contract: tokenFactory,
    method: 'transferOwner',
    params: {new_owner: newOwner.address},
    value: locklift.utils.convertCrystal(1, 'nano'),
    keyPair: keyPairs[0]
  });
  console.log(`Accepting transfer for DexRoot: ${dexRoot.address}`);
  await submitTransactionAcceptOwner(newOwner, dexRoot, keyPairs[1]);
  console.log(`Accepting transfer for DexVault: ${dexVault.address}`);
  await submitTransactionAcceptOwner(newOwner, dexVault, keyPairs[1]);
  console.log(`Accepting transfer for TokenFactory: ${tokenFactory.address}`);
  await submitTransactionAcceptOwner(newOwner, tokenFactory, keyPairs[1]);

  console.log(`transIds: ${await newOwner.call({method: 'getTransactionIds'})}`);
}

main()
  .then(() => process.exit(0))
  .catch(e => {
    console.log(e);
    process.exit(1);
  });
