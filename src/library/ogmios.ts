import * as Ogmios from '@cardano-ogmios/client'

async function getContext() {
	const context : Ogmios.InteractionContext = await Ogmios.createInteractionContext(
		err => console.error(err),
		() => console.log("Connection closed."),
		{ connection: { host: 'ogmios-api.testnet.dandelion.link', port: 443, tls: true } }
	)

	return context
}


export async function getProtocolParams() {
	const context = await getContext();
	const State = await Ogmios.createStateQueryClient(context);
	return State.currentProtocolParameters();
}

export async function submitTx(transaction: string) {
	const context = await getContext();
	const Client = await Ogmios.createTxSubmissionClient(context)
	try {
		const hash =  await Client.submitTx(transaction)
	}
	catch(error) {
		console.log(error);
	}
}