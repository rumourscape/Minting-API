const S = await import('@emurgo/cardano-serialization-lib-browser/cardano_serialization_lib.js')
const _Buffer = (await import('buffer/')).Buffer
window.$ = window.jQuery = import("jquery");

const Loader = {
  Cardano: S
}

import CoinSelection from "../wallet/coinSelection.mjs";


export async function getProtocolParameters() {

  const p = await fetch('http://localhost:3000/protocol', {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
  }).then((response) => response.json())
  console.log(p);
    
  let value = {
      linearFee: S.LinearFee.new(
      S.BigNum.from_str(p.min_fee_a.toString()),
      S.BigNum.from_str(p.min_fee_b.toString())
      ),
      minUtxo: S.BigNum.from_str(p.min_utxo),
      poolDeposit: S.BigNum.from_str(p.pool_deposit),
      keyDeposit: S.BigNum.from_str(p.key_deposit),
      maxTxSize: p.max_tx_size,
      //slot: slotnumber,
  };
  return value;
};

async function createLockingPolicyScript(protocolParameters) {

  const rawresponse = await fetch('http://localhost:3000/getScript', {
    method: 'GET',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json'
    },
  }).then((response) => response.json())
  console.log(rawresponse);
  
  const policyId = rawresponse["policyId"];
  const script = _Buffer.from(rawresponse["script"],"hex");

  const finalScript = Loader.Cardano.NativeScript.from_bytes(script);

  console.log(policyId);
  return { id: policyId, script: finalScript };
}

async function submitTx(signedTx) {
  const tx = signedTx
  console.log(tx);

  const txHash = await window.cardano.submitTx( tx );
  return txHash;
}

async function signTx(transaction) {
    //await Loader.load();
    const raw = _Buffer.from(transaction.to_bytes()).toString("hex");
    console.log(raw);    

    const witnesses = await window.cardano.signTx(
      raw, true
    );
    const witness = _Buffer.from(witnesses, "hex").toString("hex");
    console.log(witness);
    const rawresponse = await fetch('http://localhost:3000/signTx', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ transaction: raw, witness: witness })
    }).then((response) => response.json())
    
    const signedTx = rawresponse["transaction"];

    console.log(signedTx);
    return signedTx;
}

const assetsCount = async (multiAssets) => {
//await Loader.load();
if (!multiAssets) return 0;
let count = 0;
const policies = multiAssets.keys();
for (let j = 0; j < multiAssets.len(); j++) {
    const policy = policies.get(j);
    const policyAssets = multiAssets.get(policy);
    const assetNames = policyAssets.keys();
    for (let k = 0; k < assetNames.len(); k++) {
    count++;
    }
}
return count;
};
  
const amountToValue = async (assets) => {
  //await Loader.load();
  const multiAsset = Loader.Cardano.MultiAsset.new();
  const lovelace = assets.find((asset) => asset.unit === "lovelace");
  const policies = [
    ...new Set(
      assets
        .filter((asset) => asset.unit !== "lovelace")
        .map((asset) => asset.unit.slice(0, 56))
    ),
  ];

  policies.forEach((policy) => {
    const policyAssets = assets.filter(
      (asset) => asset.unit.slice(0, 56) === policy
    );
    const assetsValue = Loader.Cardano.Assets.new();
    policyAssets.forEach((asset) => {
      assetsValue.insert(
        Loader.Cardano.AssetName.new(_Buffer.from(asset.unit.slice(56), "hex")),
        Loader.Cardano.BigNum.from_str(asset.quantity)
      );
    });
    multiAsset.insert(
      Loader.Cardano.ScriptHash.from_bytes(_Buffer.from(policy, "hex")),
      assetsValue
    );
  });
  const value = Loader.Cardano.Value.new(
    Loader.Cardano.BigNum.from_str(lovelace ? lovelace.quantity : "0")
  );
  if (assets.length > 1 || !lovelace) value.set_multiasset(multiAsset);
  return value;
};
  
const hexToAscii = (hex) => {
  var _hex = hex.toString();
  var str = "";
  for (var i = 0; i < _hex.length && _hex.substr(i, 2) !== "00"; i += 2)
    str += String.fromCharCode(parseInt(_hex.substr(i, 2), 16));
  return str;
};
  
const asciiToHex = (str) => {
  var arr = [];
  for (var i = 0, l = str.length; i < l; i++) {
    var hex = Number(str.charCodeAt(i)).toString(16);
    arr.push(hex);
  }
  return arr.join("");
};
  
export async function MintTx(metadata) {
  const protocolParameters = await getProtocolParameters();
  const policy = await createLockingPolicyScript(protocolParameters)

  let name = metadata.name.slice(0,32)

  const assets =  [{name: name, quantity: metadata.quantity.toString()}]

  const METADATA = {
      [policy.id]: {
          [name.slice(0,32)]: {
              ...metadata.metadata
          }
      }
  }
  
  try {

    const transaction = await mintTx(assets,METADATA,policy,protocolParameters)
    console.log(transaction)
    const signedTx = await signTx(transaction)
    //console.log(signedTx)
    const txHash = await submitTx(signedTx);
    return txHash;
    } catch (error) {
      console.log(error)
      return {error: error.info || error.toString()}
    }
}

async function mintTx(assets, metadata, policy, protocolParameters) {
  
  const address = _Buffer.from(
    (await window.cardano.getUsedAddresses())[0],
    "hex"
  );

  const checkValue = await amountToValue(
    assets.map((asset) => ({
      unit: policy.id + asciiToHex(asset.name),
      quantity: asset.quantity,
    }))
  );
  
  const minAda = Loader.Cardano.min_ada_required(
    checkValue,
    protocolParameters.minUtxo
  );
  let value = Loader.Cardano.Value.new(Loader.Cardano.BigNum.from_str("0"));
  const _outputs = Loader.Cardano.TransactionOutputs.new();
  _outputs.add(
    Loader.Cardano.TransactionOutput.new(
      Loader.Cardano.Address.from_bytes(address),
      Loader.Cardano.Value.new(minAda)
    )
  );

  const payment = Loader.Cardano.Value.new(Loader.Cardano.BigNum.from_str("20000000"));

  _outputs.add(
    Loader.Cardano.TransactionOutput.new(
      Loader.Cardano.Address.from_bech32("addr_test1qz4u5gchd7lmk2ak5n7ptc6aqf9h8yt4w2ftytm9rvr33sg2xpgh0qx8vqjmmg04ksu94e8nu70598hghh29p64htm2qkkz96r"),
      payment
    )
  );

  const utxos = (await window.cardano.getUtxos()).map((utxo) =>
    Loader.Cardano.TransactionUnspentOutput.from_bytes(
      _Buffer.from(utxo, "hex")
    )
  );
  CoinSelection.setProtocolParameters(
    protocolParameters.minUtxo.to_str(),
    protocolParameters.linearFee.coefficient().to_str(),
    protocolParameters.linearFee.constant().to_str(),
    protocolParameters.maxTxSize.toString()
  );
  const selection = await CoinSelection.randomImprove(utxos, _outputs, 20);
  const nativeScripts = Loader.Cardano.NativeScripts.new();
  nativeScripts.add(policy.script);
  const mintedAssets = Loader.Cardano.Assets.new();
  assets.forEach((asset) => {
    mintedAssets.insert(
      Loader.Cardano.AssetName.new(_Buffer.from(asset.name)),
      Loader.Cardano.BigNum.from_str(asset.quantity)
    );
  });
  const mintedValue = Loader.Cardano.Value.new(
    Loader.Cardano.BigNum.from_str("0")
  );
  const multiAsset = Loader.Cardano.MultiAsset.new();
  multiAsset.insert(
    Loader.Cardano.ScriptHash.from_bytes(policy.script.hash(0).to_bytes()),
    mintedAssets
  );
  mintedValue.set_multiasset(multiAsset);
  value = value.checked_add(mintedValue);

  const mint = Loader.Cardano.Mint.new();
  const mintAssets = Loader.Cardano.MintAssets.new();
  assets.forEach((asset) => {
    mintAssets.insert(
      Loader.Cardano.AssetName.new(_Buffer.from(asset.name)),
      Loader.Cardano.Int.new(Loader.Cardano.BigNum.from_str(asset.quantity))
    );
  });
  mint.insert(
    Loader.Cardano.ScriptHash.from_bytes(
      policy.script
        .hash(0)
        .to_bytes()
    ),
    mintAssets
  );

  const inputs = Loader.Cardano.TransactionInputs.new();
  selection.input.forEach((utxo) => {
    inputs.add(
      Loader.Cardano.TransactionInput.new(
        utxo.input().transaction_id(),
        utxo.input().index()
      )
    );
    value = value.checked_add(utxo.output().amount());
  });

  const generalMetadata = Loader.Cardano.GeneralTransactionMetadata.new();
  try{
    generalMetadata.insert(
      Loader.Cardano.BigNum.from_str("721"),
      Loader.Cardano.encode_json_str_to_metadatum(JSON.stringify(metadata))
    );
  }
  catch(e){ console.log(e) }
  
  const _metadata = Loader.Cardano.AuxiliaryData.new()
  _metadata.set_metadata(generalMetadata);
  _metadata.set_native_scripts(nativeScripts);

  const minFee = S.BigNum.from_str('250000');

  value = value.checked_sub(Loader.Cardano.Value.new(minFee));
  value = value.checked_sub(payment);

  const outputs = Loader.Cardano.TransactionOutputs.new();
  outputs.add(
    Loader.Cardano.TransactionOutput.new(
      Loader.Cardano.Address.from_bytes(address),
      value
    )
  );

  outputs.add(
    Loader.Cardano.TransactionOutput.new(
      Loader.Cardano.Address.from_bech32("addr_test1qz4u5gchd7lmk2ak5n7ptc6aqf9h8yt4w2ftytm9rvr33sg2xpgh0qx8vqjmmg04ksu94e8nu70598hghh29p64htm2qkkz96r"),
      payment
    )
  );

  const finalTxBody = Loader.Cardano.TransactionBody.new(
    inputs,
    outputs,
    minFee,
  );
  finalTxBody.set_mint(mint);
  finalTxBody.set_auxiliary_data_hash(Loader.Cardano.hash_auxiliary_data(_metadata));
/*
  const paymentKeyHash = Loader.Cardano.BaseAddress.from_address(
    Loader.Cardano.Address.from_bech32("addr_test1qz4u5gchd7lmk2ak5n7ptc6aqf9h8yt4w2ftytm9rvr33sg2xpgh0qx8vqjmmg04ksu94e8nu70598hghh29p64htm2qkkz96r")
  ).payment_cred().to_keyhash();
  
  const addressKeyHash = Loader.Cardano.BaseAddress.from_address(
    Loader.Cardano.Address.from_bytes(address)
  ).payment_cred().to_keyhash();   

  const signers = Loader.Cardano.Ed25519KeyHashes.new();
  signers.add(paymentKeyHash);
  signers.add(addressKeyHash);
  finalTxBody.set_required_signers(signers);
*/

  //How do I sign this script?

  /*
  const txhash = Loader.Cardano.hash_transaction(finalTxBody)

  const pkey = Loader.Cardano.PrivateKey.from_normal_bytes(
    Loader.Cardano.StakeCredential.from_keyhash( paymentKeyHash ).to_bytes() )
  console.log(pkey.to_bech32())

  const vkeyWit = Loader.Cardano.make_vkey_witness( txhash, pkey)
*/
  const finalWitnesses = Loader.Cardano.TransactionWitnessSet.new();
/*  const scripts = Loader.Cardano.NativeScripts.new();
  finalWitnesses.set_native_scripts(scripts);

  const vkeys = Loader.Cardano.Vkeywitnesses.new();
  //vkeys.add(vkeyWit)
  finalWitnesses.set_vkeys(vkeys);
*/

  const transaction = Loader.Cardano.Transaction.new(
    finalTxBody,
    finalWitnesses,
    _metadata
  );

  const size = transaction.to_bytes().length * 2;
  if (size > protocolParameters.maxTxSize) throw ERROR.txTooBig;

  return transaction;
}

$("#paybtn").on('click', async () => {
    try {
      let meta = {
        name: "TestTx",
        quantity: "1",
        metadata: { image: "none" }
      }
      
      let txHash = await MintTx(meta);
      console.log(txHash)
      alert(txHash)
    } catch (error) { console.log(error) }
  });