# Cardano Token Minting-API
An Innovative way of minting Cardano Native Assets
<br><br>
## Introduction
<br>
This project introduces a new way of selling a CNFT.
<br><br>
Currently, the most widely used model of minting NFTs is where the Buyer sends a payment to the Seller who then proceeds to mint the said NFT and then returns it.
This means that there are at least two transactions that occur in such an exchange. This method is very inefficient.
<br><br>
Cardano's EUTXO model means that multple exchanges, mints and script executions can occur inside one transaction. This project just leverages those capabilities and proves a way of minting a token without revealing the script's private keys to the end user. This means that the buyer makes the payment and the seller mints and returns the NFT in the same transaction.
<br><br>
The benifits of this new model are: <br>
✔ Maximum Efficiency <br>
✔ Minimum Costs <br>
✔ Less Congestion <br>
✔ Absolute Transparency
<br><br>

## Installation
```bash
git clone https://github.com/rumourscape/Minting-API
cd Minting-API
npm install
```
<br>

## Usage
Create the env.json file according to the example-env.json template.
```bash
npm run start
```
