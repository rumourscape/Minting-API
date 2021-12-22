import { Body, Controller, Get, Header, Post } from '@nestjs/common';
import { getProtocolParams } from '../library/blockfrost';
import { getScript, signTx } from '../library/cardano';

@Controller('protocol')
export class Protocol {
  @Get()
  async get() {
    return await getProtocolParams();
  }
}

@Controller('getScript')
export class Script {
	@Get()
	get() {
		return getScript()
	}
}

export class Tx {
  transaction : string;
  witness : string;
}

@Controller('signTx')
export class SignTx {
  @Post()
  @Header('Content-Type', 'application/json')
  async post(@Body() tx: Tx) {
    //console.log(tx.transaction)
    //console.log(tx.witness)
    const response = signTx(tx.transaction, tx.witness)
    return response
  }
}