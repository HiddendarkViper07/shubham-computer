const crypto = require('crypto');
const PaymentSettings = require('../models/PaymentSettings');

class PaymentService {
    constructor() {
        this.settings = null;
    }

    async loadSettings() {
        if (!this.settings) {
            this.settings = await PaymentSettings.findOne();
            if (!this.settings) {
                this.settings = new PaymentSettings({
                    paymentEnabled: true,
                    activeGateway: 'razorpay',
                    razorpay: {
                        enabled: true,
                        keyId: process.env.RAZORPAY_KEY_ID || '',
                        keySecret: process.env.RAZORPAY_KEY_SECRET || '',
                        testMode: true
                    },
                    easebuzz: {
                        enabled: false,
                        merchantKey: process.env.EASEBUZZ_MERCHANT_KEY || '',
                        saltKey: process.env.EASEBUZZ_SALT_KEY || '',
                        accessKey: process.env.EASEBUZZ_ACCESS_KEY || '',
                        testMode: true,
                        env: 'test'
                    }
                });
                await this.settings.save();
            }
        }
        return this.settings;
    }

    async isPaymentEnabled() {
        const settings = await this.loadSettings();
        return settings.paymentEnabled && settings.activeGateway !== 'none';
    }

    async getActiveGateway() {
        const settings = await this.loadSettings();
        if (!settings.paymentEnabled) return 'none';
        return settings.activeGateway;
    }

    async getGatewayConfig() {
        const settings = await this.loadSettings();
        return {
            paymentEnabled: settings.paymentEnabled,
            activeGateway: settings.activeGateway,
            razorpay: {
                enabled: settings.razorpay.enabled,
                keyId: settings.razorpay.keyId || process.env.RAZORPAY_KEY_ID || ''
            },
            easebuzz: {
                enabled: settings.easebuzz.enabled,
                merchantKey: settings.easebuzz.merchantKey || process.env.EASEBUZZ_MERCHANT_KEY || '',
                env: settings.easebuzz.env || 'test'
            }
        };
    }

    generateEasebuzzHash(data, salt) {
        const hashString = `${data.key}|${data.txnid}|${data.amount}|${data.productinfo}|${data.firstname}|${data.email}|||||||||||${salt}`;
        return crypto.createHash('sha512').update(hashString).digest('hex');
    }

    verifyEasebuzzResponse(response, salt) {
        const receivedHash = response.hash;
        delete response.hash;
        const hashString = `${salt}|${response.status}|||||||||${response.email}|${response.firstname}|${response.productinfo}|${response.amount}|${response.txnid}|${response.key}`;
        const calculatedHash = crypto.createHash('sha512').update(hashString).digest('hex');
        return receivedHash === calculatedHash;
    }
}

module.exports = new PaymentService();