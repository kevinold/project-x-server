import { SNSEvent } from "aws-lambda";
import * as AWS from "aws-sdk";
import { handlerAsync } from "../appUninstalled";

beforeAll(() => {
    process.env.SHOPS_TABLE = "shops";
    process.env.APP_INSTALLED_TOPIC_ARN = "app_install_topic";
});

afterAll(() => {
    delete process.env.SHOPS_TABLE;
    delete process.env.APP_INSTALLED_TOPIC_ARN;
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
                    data: null,
                    event: "app/uninstalled",
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

    const now = new Date(1516962874000);

    const dynamodb = new AWS.DynamoDB.DocumentClient();
    dynamodb.delete = jest.fn().mockName("dynamodb.delete").mockReturnValueOnce({
        promise: () => new Promise<void>((resolve) => resolve()),
    });
    dynamodb.get = jest.fn().mockName("dynamodb.get").mockReturnValueOnce({
        promise: () => new Promise<AWS.DynamoDB.DocumentClient.GetItemOutput>((resolve) => resolve({
            Item: {
                shopDomain: "example.myshopify.com",
            },
        })),
    });
    dynamodb.put = jest.fn().mockName("dynamodb.put").mockReturnValueOnce({
        promise: () => new Promise<void>((resolve) => resolve()),
    });

    const result = await handlerAsync(
        event,
        dynamodb,
        now,
    );

    expect(result).toBeTruthy();
    expect(dynamodb.delete).toBeCalledWith({
        Key: {
            shopDomain: "example.myshopify.com",
        },
        TableName: "shops",
    });
    expect(dynamodb.get).toBeCalledWith({
        Key: {
            shopDomain: "example.myshopify.com",
        },
        TableName: "shops",
    });
    expect(dynamodb.put).toBeCalledWith({
        Item: {
            shopDomain: "example.myshopify.com-uninstalled-1516962874000",
            uninstalledAt: "2018-01-26T10:34:34.000Z",
        },
        TableName: "shops",
    });
});
