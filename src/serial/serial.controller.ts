import { Controller, Get, Post } from '@nestjs/common';
import * as Cardano from '@emurgo/cardano-serialization-lib-nodejs';
import { mnemonicToEntropy } from 'bip39';
import { readFileSync } from 'fs';
import { Buffer } from 'buffer';

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
  const phrase = readFileSync('./keys/phrase.prv', 'utf-8');
  //console.log(phrase);

  const entropy = mnemonicToEntropy(phrase);
  console.log(entropy);
  const rootKey = Cardano.Bip32PrivateKey.from_bip39_entropy(
    Buffer.from(entropy, 'hex'),
    Buffer.from(''),
  );
  return rootKey
    .derive(harden(Purpose.CIP1852))
    .derive(harden(CoinTypes.CARDANO))
    .derive(harden(0)); // account #0
}

function CreateKeys() {
  const rootkey = getCip1852Account();
  const prvkey = rootkey.to_raw_key();
  const pubkey = prvkey.to_public();
  //console.log(prvkey.to_bech32());
  return pubkey.to_bech32();
}

function GetAddress() {
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

  return baseAddr.to_address().to_bech32();
}

@Controller('serial')
export class SerialController {
  @Get()
  getScript() {
    return GetAddress();
  }
}
