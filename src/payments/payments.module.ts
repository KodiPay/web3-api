import { Module } from '@nestjs/common';
import { MpesaService } from './service/mpesa/mpesa.service';
import { MpesaController } from './controller/mpesa/mpesa.controller';

@Module({
  providers: [ MpesaService],
  controllers: [MpesaController]
})
export class PaymentsModule {}
