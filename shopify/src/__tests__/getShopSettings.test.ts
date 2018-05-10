import { SNSEvent } from "aws-lambda";
import * as AWS from "aws-sdk";
import * as Shopify from "shopify-api-node";
import { handlerAsync } from "../getShopSettings";

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

    const shop = {
        shop: {
            get: jest.fn().mockName("shopify.get").mockReturnValue({
                county_taxes: null,
                domain: "example.com",
                email: "owner@example.myshopify.com",
                name: "My Store",
                source: "partner",
                tax_shipping: null,
                taxes_included: null,
                timezone: "Australia/Sydney",
            }),
        },
    };
    const mockFactory: jest.Mock<Shopify> = jest.fn().mockReturnValue(shop) as jest.Mock<Shopify>;

    const dynamodb = new AWS.DynamoDB.DocumentClient();
    dynamodb.update = jest.fn().mockName("dynamodb.update").mockReturnValueOnce({
        promise: () => new Promise<void>((resolve) => resolve()),
    });

    const sns = new AWS.SNS({ apiVersion: "2010-03-31" });
    sns.publish = jest.fn().mockName("sns.publish").mockReturnValue({
        promise: () => new Promise<void>((resolve) => resolve()),
    });

    const result = await handlerAsync(
        event,
        mockFactory,
        dynamodb,
        sns,
    );

    expect(result).toBeTruthy();
    expect(mockFactory).toBeCalledWith("accessToken", "example.myshopify.com");
    expect(shop.shop.get).toBeCalled();
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
    expect(sns.publish).toBeCalledWith({
        // tslint:disable-next-line:max-line-length
        Message: "{\"data\":{\"county_taxes\":null,\"domain\":\"example.com\",\"email\":\"owner@example.myshopify.com\",\"name\":\"My Store\",\"source\":\"partner\",\"tax_shipping\":null,\"taxes_included\":null,\"timezone\":\"Australia/Sydney\"},\"event\":\"app/installed\",\"shopDomain\":\"example.myshopify.com\"}",
        TopicArn: "app_install_topic",
    });
});
