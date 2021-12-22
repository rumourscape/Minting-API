import { BlockFrostAPI } from '@blockfrost/blockfrost-js';
import env from 'src/env.json'

const API = new BlockFrostAPI({
  projectId: env.blockfrost.projectId,
});

export async function getProtocolParams() {
  const epoch = await API.epochsLatest().then((result) => result.epoch);
  const protocol = await API.epochsParameters(epoch);
  return protocol;
}
