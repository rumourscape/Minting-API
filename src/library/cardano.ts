import * as Cardano from '@emurgo/cardano-serialization-lib-nodejs';
import { submitTx } from './ogmios';
import { mnemonicToEntropy } from 'bip39';
import { readFileSync } from 'fs';
import { Buffer } from 'buffer';
import env from 'src/env.json'


function harden(num: number): number {
  return 0x80000000 + num;
}

// Purpose derivation (See BIP43)
enum Purpose {
  CIP1852 = 1852, // see CIP 1852
}

// Cardano coin type (SLIP 44)
enum CoinTypes {
  CARDANO = 1815,
}

enum ChainDerivation {
  EXTERNAL = 0, // from BIP44
  INTERNAL = 1, // from BIP44
  CHIMERIC = 2, // from CIP1852
}

function getCip1852Account(): Cardano.Bip32PrivateKey {
  const entropy = mnemonicToEntropy(env.phrase);

  const rootKey = Cardano.Bip32PrivateKey.from_bip39_entropy(
    Buffer.from(entropy, 'hex'),
    Buffer.from(''),
  );
  return rootKey
    .derive(harden(Purpose.CIP1852))
    .derive(harden(CoinTypes.CARDANO))
    .derive(harden(0)); // account #0
}

//Keys
const rootkey = getCip1852Account();
const prvkey = rootkey.to_raw_key();
const pubkey = prvkey.to_public();
const pubhash = pubkey.hash();
console.log(pubkey.to_bech32())

export function getBaseAddress() {
  const cip1852Account = getCip1852Account();

  const utxoPubKey = cip1852Account
    .derive(ChainDerivation.EXTERNAL)
    .derive(0)
    .to_public();
	const stakeKey = cip1852Account
    .derive(ChainDerivation.CHIMERIC)
    .derive(0)
    .to_public();

  const baseAddr = Cardano.BaseAddress.new(
    0,
    Cardano.StakeCredential.from_keyhash(utxoPubKey.to_raw_key().hash()),
    Cardano.StakeCredential.from_keyhash(stakeKey.to_raw_key().hash()),
  );

  //return baseAddr.to_address().to_bech32();
  return baseAddr
}

export function getScript() {
  const lock = Cardano.TimelockExpiry.new(45299919);
	const nativeScripts = Cardano.NativeScripts.new();
  const keyhash = getBaseAddress().payment_cred().to_keyhash()
	const script = Cardano.ScriptPubkey.new(keyhash);
	const nativeScript = Cardano.NativeScript.new_script_pubkey(script);
	const lockScript = Cardano.NativeScript.new_timelock_expiry(lock);

	nativeScripts.add(nativeScript);
	nativeScripts.add(lockScript);
	
	const finalScript = Cardano.NativeScript.new_script_all(
		Cardano.ScriptAll.new(nativeScripts)
	);

	//const scripthash = Cardano.ScriptHash.from_bytes( finalScript.hash(0).to_bytes() );

	const policyId = Buffer.from( finalScript.hash(0).to_bytes() ).toString('hex');
	
  return {
    policyId : policyId,
    script : Buffer.from(finalScript.to_bytes()).toString("hex"),
  };
	
}

function Script() {
  const lock = Cardano.TimelockExpiry.new(45299919);
	const nativeScripts = Cardano.NativeScripts.new();
  const keyhash = getBaseAddress().payment_cred().to_keyhash()
	const script = Cardano.ScriptPubkey.new(keyhash);
	const nativeScript = Cardano.NativeScript.new_script_pubkey(script);
	const lockScript = Cardano.NativeScript.new_timelock_expiry(lock);

	nativeScripts.add(nativeScript);
	nativeScripts.add(lockScript);
	
	const finalScript = Cardano.NativeScript.new_script_all(
		Cardano.ScriptAll.new(nativeScripts)
	);

  return finalScript
}

export function signTx(tx: string, witness: string) {

  const transaction = Cardano.Transaction.from_bytes(Buffer.from(tx, 'hex'))
  
  //const txWitnesses = Cardano.TransactionWitnessSet;
  const txVkeys = Cardano.Vkeywitnesses.new();
  const txScripts = Cardano.NativeScripts.new();

  const addWitnesses = Cardano.TransactionWitnessSet.from_bytes(
      Buffer.from( witness, "hex")
  );
/*
  const signers = Cardano.Ed25519KeyHashes.new();
  signers.add(pubhash);
  transaction.body().set_required_signers(signers);
*/    
  const txhash = Cardano.hash_transaction(transaction.body());

  const vkeyWit = Cardano.make_vkey_witness( txhash, prvkey )
  //console.log(vkeyWit.vkey().public_key().to_bech32())

  const script = Script()
  txScripts.add(script)
  txVkeys.add(vkeyWit);
  //addScripts.add(script);
  
  const addVkeys = addWitnesses.vkeys();
  const addScripts = addWitnesses.native_scripts();

  const totalVkeys = Cardano.Vkeywitnesses.new();
  const totalScripts = Cardano.NativeScripts.new();

  if (txVkeys) {
    for (let i = 0; i < txVkeys.len(); i++) {
      totalVkeys.add(txVkeys.get(i));
    }
  }
  if (txScripts) {
    for (let i = 0; i < txScripts.len(); i++) {
      totalScripts.add(txScripts.get(i));
    }
  }
  if (addVkeys) {
    for (let i = 0; i < addVkeys.len(); i++) {
      totalVkeys.add(addVkeys.get(i));
    }
  }
  if (addScripts) {
    for (let i = 0; i < addScripts.len(); i++) {
      totalScripts.add(addScripts.get(i));
    }
  }

  const totalWitnesses = transaction.witness_set();
  totalWitnesses.set_vkeys(totalVkeys);
  totalWitnesses.set_native_scripts(totalScripts);

  const signedTx = Cardano.Transaction.new(
    transaction.body(),
    totalWitnesses,
    transaction.auxiliary_data()
  );

  const signedTx_cborHex = Buffer.from(signedTx.to_bytes()).toString('hex')
  console.log(signedTx_cborHex)
  return submitTx(signedTx_cborHex)
  //return { 'transaction' : signedTx_cborHex}
}