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

    const dynamodb = new AWS.DynamoDB.DocumentClient();
    dynamodb.delete = jest.fn().mockName("dynamodb.delete").mockReturnValueOnce({
        promise: () => new Promise<void>((resolve) => resolve()),
    });

    const result = await handlerAsync(
        event,
        dynamodb,
    );

    expect(result).toBeTruthy();
    expect(dynamodb.delete).toBeCalledWith({
        Key: {
            shopDomain: "example.myshopify.com",
        },
        TableName: "shops",
    });
});
