import { Controller, Param, Post, Req, Sse } from '@nestjs/common';
import { MpesaService } from '../../service/mpesa/mpesa.service';
import { AppService } from '../../../app.service';
import * as moment from 'moment-timezone';
import { Observable } from 'rxjs';

enum PaymentStatus{
    success,
    failed
}
@Controller('mpesa')
export class MpesaController {
    constructor(
        private service: MpesaService, 
        private appService: AppService
    ) { }

    @Post('mpesa/callback')
    async mpesaCallback(@Req() req) {
        const response = req.body.Body.stkCallback;
        let clientResponse: any;
        let txRequestId = response.MerchantRequestID
        if (response.ResultCode == 0) {
            let mpesaReceiptNo;

            response.CallbackMetadata.Item.map(i => {
                if (i.Name == 'MpesaReceiptNumber') {
                    mpesaReceiptNo = i.Value
                }
            })
            // update transaction record to success
            const payment = await this.service.update(
                { paymentRequestId: txRequestId },
                { status: PaymentStatus.success, statusMessage: response.ResultDesc, receiptNo: mpesaReceiptNo });
            
            // update ad to paid & calculate expiry date
            let ad = await this.adService.findOne({_id: payment.typeId})
            let validUntil = moment.tz(moment(), 'Africa/Nairobi').add(ad.duration, 'days').format();
            ad = await this.adService.update(ad._id, { paid: true, activeUntil: validUntil })
            // SSE message to client subscribed
            clientResponse = { status: true, message: `Receipt #${mpesaReceiptNo}` }

        } else {
            // update transaction record to failed
            await this.service.update(
                { paymentRequestId: txRequestId },
                { status: PaymentStatus.failed, statusMessage: response.ResultDesc });

            // message to send to client via message broker
            clientResponse = { status: false, message: response.ResultDesc }
        }

        // send update to message broker
        this.appService.emit(txRequestId, clientResponse);

        return;
    }

    @Sse('sse/:id')
    sse(@Param() params): Observable<MessageEvent> {
        return this.appService.subscribe(params.id);
    }
}

