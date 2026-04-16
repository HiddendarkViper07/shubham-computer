const mongoose = require('mongoose');
require('dotenv').config();

const ServiceConfig = require('./models/ServiceConfig');

const defaultServices = [
    {
        serviceName: "Income Certificate",
        description: "Income certificate for government schemes",
        requiredDocuments: [
            { name: "Aadhar Card", isRequired: true, maxSize: 2 },
            { name: "Ration Card", isRequired: true, maxSize: 2 },
            { name: "Income Proof", isRequired: true, maxSize: 2 },
            { name: "Residence Proof", isRequired: true, maxSize: 2 },
            { name: "Passport Photo", isRequired: true, maxSize: 2 }
        ],
        processingFee: 50,
        estimatedDays: 5,
        displayOrder: 1,
        isActive: true
    },
    {
        serviceName: "Caste Certificate",
        description: "Caste certificate for reservation benefits",
        requiredDocuments: [
            { name: "Aadhar Card", isRequired: true, maxSize: 2 },
            { name: "School Leaving", isRequired: true, maxSize: 2 },
            { name: "Father's Caste Certificate", isRequired: true, maxSize: 2 },
            { name: "Affidavit", isRequired: true, maxSize: 2 },
            { name: "Passport Photo", isRequired: true, maxSize: 2 }
        ],
        processingFee: 50,
        estimatedDays: 7,
        displayOrder: 2,
        isActive: true
    },
    {
        serviceName: "EWS Certificate",
        description: "Economically Weaker Section certificate",
        requiredDocuments: [
            { name: "Aadhar Card", isRequired: true, maxSize: 2 },
            { name: "Income Certificate", isRequired: true, maxSize: 2 },
            { name: "Caste Certificate", isRequired: true, maxSize: 2 },
            { name: "Residence Proof", isRequired: true, maxSize: 2 },
            { name: "Passport Photo", isRequired: true, maxSize: 2 }
        ],
        processingFee: 50,
        estimatedDays: 5,
        displayOrder: 3,
        isActive: true
    },
    {
        serviceName: "Domicile",
        description: "Domicile/Residence certificate",
        requiredDocuments: [
            { name: "Aadhar Card", isRequired: true, maxSize: 2 },
            { name: "Birth Certificate", isRequired: true, maxSize: 2 },
            { name: "Residence Proof", isRequired: true, maxSize: 2 },
            { name: "Parent's Domicile", isRequired: true, maxSize: 2 },
            { name: "Passport Photo", isRequired: true, maxSize: 2 }
        ],
        processingFee: 50,
        estimatedDays: 10,
        displayOrder: 4,
        isActive: true
    },
    {
        serviceName: "Non-Creamy Layer",
        description: "Non-Creamy Layer certificate for OBC",
        requiredDocuments: [
            { name: "Aadhar Card", isRequired: true, maxSize: 2 },
            { name: "Income Certificate", isRequired: true, maxSize: 2 },
            { name: "Caste Certificate", isRequired: true, maxSize: 2 },
            { name: "Affidavit", isRequired: true, maxSize: 2 },
            { name: "Passport Photo", isRequired: true, maxSize: 2 }
        ],
        processingFee: 50,
        estimatedDays: 7,
        displayOrder: 5,
        isActive: true
    },
    {
        serviceName: "Scholarship",
        description: "Scholarship application assistance",
        requiredDocuments: [
            { name: "Aadhar Card", isRequired: true, maxSize: 2 },
            { name: "Mark Sheet", isRequired: true, maxSize: 2 },
            { name: "Income Certificate", isRequired: true, maxSize: 2 },
            { name: "Caste Certificate", isRequired: true, maxSize: 2 },
            { name: "Bank Passbook", isRequired: true, maxSize: 2 },
            { name: "Passport Photo", isRequired: true, maxSize: 2 }
        ],
        processingFee: 50,
        estimatedDays: 14,
        displayOrder: 6,
        isActive: true
    }
];

async function seedServices() {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        
        for (const service of defaultServices) {
            await ServiceConfig.findOneAndUpdate(
                { serviceName: service.serviceName },
                service,
                { upsert: true, new: true }
            );
        }
        
        console.log('✅ Default services seeded successfully!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Error:', error);
        process.exit(1);
    }
}

seedServices();