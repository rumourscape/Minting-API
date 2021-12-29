import { Module } from '@nestjs/common';
import * as route from 'src/controller/controller';

@Module({
  imports: [],
  controllers: [route.Protocol, route.Script, route.SignTx],
})
export class AppModule {}
