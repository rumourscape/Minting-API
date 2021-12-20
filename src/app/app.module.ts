import { Module } from '@nestjs/common';
import { SerialController } from 'src/serial/serial.controller';

@Module({
  imports: [],
  controllers: [SerialController],
})
export class AppModule {}
