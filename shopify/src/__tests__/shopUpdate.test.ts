import { SNSEvent } from "aws-lambda";
import * as AWS from "aws-sdk";
import { handlerAsync } from "../shopUpdate";

beforeAll(() => {
    process.env.SHOPS_TABLE = "shops";
});

afterAll(() => {
    delete process.env.SHOPS_TABLE;
});

test("Happy path", async () => {
    const event: SNSEvent = {
        Records: [{
            EventSource: "",
            EventSubscriptionArn: "",
            EventVersion: "",
            Sns: {
                Message: JSON.stringify({
                    accessToken: "accessToken",
                    data: {
                        country_code: "AU",
                        county_taxes: null,
                        domain: "example.com",
                        email: "owner@example.myshopify.com",
                        name: "My Store",
                        source: "partner",
                        tax_shipping: null,
                        taxes_included: null,
                        timezone: "Australia/Sydney",
                    },
                    event: "shop/update",
                    shopDomain: "example.myshopify.com",
                }),
                MessageAttributes: {},
                MessageId: "",
                Signature: "",
                SignatureVersion: "",
                SigningCertUrl: "",
                Subject: "",
                Timestamp: "",
                TopicArn: "",
                Type: "",
                UnsubscribeUrl: "",
            },
        }],
    };

    const dynamodb = new AWS.DynamoDB.DocumentClient();
    dynamodb.update = jest.fn().mockName("dynamodb.update").mockReturnValueOnce({
        promise: () => new Promise<void>((resolve) => resolve()),
    });

    const result = await handlerAsync(
        event,
        dynamodb,
    );

    expect(result).toBeTruthy();
    expect(dynamodb.update).toBeCalledWith({
        ExpressionAttributeNames: {
            "#P0": "countryCode",
            "#P1": "domain",
            "#P2": "email",
            "#P3": "name",
            "#P4": "source",
            "#P5": "timezone",
        },
        ExpressionAttributeValues: {
            ":P0": "AU",
            ":P1": "example.com",
            ":P2": "owner@example.myshopify.com",
            ":P3": "My Store",
            ":P4": "partner",
            ":P5": "Australia/Sydney",
        },
        Key: {
            shopDomain: "example.myshopify.com",
        },
        TableName: "shops",
        UpdateExpression: "SET #P0 = :P0, #P1 = :P1, #P2 = :P2, #P3 = :P3, #P4 = :P4, #P5 = :P5",
    });
});
