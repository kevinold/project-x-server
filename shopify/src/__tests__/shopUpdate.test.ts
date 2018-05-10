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
            "#D": "domain",
            "#N": "name",
            "#S": "source",
            "#T": "timezone",
        },
        ExpressionAttributeValues: {
            ":D": "example.com",
            ":N": "My Store",
            ":S": "partner",
            ":T": "Australia/Sydney",
            ":email": "owner@example.myshopify.com",
        },
        Key: {
            shopDomain: "example.myshopify.com",
        },
        TableName: "shops",
        UpdateExpression: "SET #D = :D, email = :email, #N = :N, #S = :S, #T = :T",
    });
});
