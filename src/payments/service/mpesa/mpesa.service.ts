import { Injectable } from '@nestjs/common';
import * as moment from 'moment-timezone';

let unirest = require('unirest');
const Q = require('q');


@Injectable()
export class MpesaService {
    constructor(
        @InjectModel('Payments') private model: Model<IPaymentModel>
    ){}

    async save(tx: IPayment): Promise<IPayment> {
        return this.model.create(tx);
    }

    async update(query: any, data: any): Promise<IPayment> { 
        return this.model.findOneAndUpdate(query, data, { 'new': true }).exec();
    }

    async findOne(query: any): Promise<IPayment> { 
        return this.model.findOne(query).exec();
    }

    async findAll(query: any): Promise<IPayment[]> {
        return this.model.find(query).exec();
    }

    authenticate(): Promise<any>{
        let deffered = Q.defer();
        unirest('GET', process.env.MPESA_AUTH_API)
            .headers({ 'Authorization': 'Basic ' + this.createAuthCode()  })
            .send()
            .end(res => {
                if (res.error) {
                    const error = JSON.parse(res.raw_body)
                    deffered.reject({
                        code: error.errorCode,
                        message: error.errorMessage,
                        requestId: error.requestId
                    })
                }else{
                    deffered.resolve(JSON.parse(res.raw_body))
                }
            });
        
        return deffered.promise;
    }

    async initPayment(payment: IPayment, callBackUrl: string): Promise<any> {
        let deffered = Q.defer();
        let timestamp = this.createTimestamp();
        let password = this.createPassword(timestamp);

        const authCode = await this.authenticate()
        // const phoneNumber = "254" + payment.providerValue.slice(1);
        const phoneNumber = payment.providerValue; // 254722111222 format
        
        unirest('POST', process.env.MPESA_STKPUSH_API)
            .headers({
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + authCode.access_token 
            })
            .send(JSON.stringify({
                "BusinessShortCode": process.env.MPESA_SHORT_CODE,
                "Password": password,
                "Timestamp": timestamp,
                "TransactionType": "CustomerBuyGoodsOnline", // CustomerPayBillOnline
                "Amount": payment.amount,
                "PartyA": phoneNumber,
                "PartyB": process.env.MPESA_SHORT_CODE,
                "PhoneNumber": phoneNumber,
                "CallBackURL": callBackUrl,
                "AccountReference": payment.typeId,
                "TransactionDesc": payment.type
            }))
            .end(res => {
                if (res.error) {
                    const error = JSON.parse(res.raw_body)
                    deffered.reject({
                        code: error.errorCode,
                        message: error.errorMessage,
                        requestId: error.requestId
                    })
                }else{
                    deffered.resolve(JSON.parse(res.raw_body))
                }
            });
        return deffered.promise;
    }

    createTimestamp(){
        // format timestamp YYYYMMDDHHMMSS
        return moment.tz(moment(), 'Africa/Nairobi').format('YYYYMMDDHHmmss');
    }

    createPassword(createdAt): string{
        const encoded = Buffer.from(process.env.MPESA_SHORT_CODE+process.env.MPESA_PASSKEY+createdAt).toString('base64') 
        return encoded;
    }

    createAuthCode(): string{
        const encoded = Buffer.from(process.env.MPESA_CONSUMER_KEY+':'+process.env.MPESA_CONSUMER_SECRET).toString('base64') 
        return encoded;
    }
}
