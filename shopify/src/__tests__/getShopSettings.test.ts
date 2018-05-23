import { SNSEvent } from "aws-lambda";
import * as AWS from "aws-sdk";
import * as fetch from "jest-fetch-mock";

import { handlerAsync } from "../getShopSettings";
import * as GetShopSettingsQueryGQL from "../graphql/GetShopSettingsQuery.graphql";

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

    const dynamodb = new AWS.DynamoDB.DocumentClient();
    dynamodb.update = jest.fn().mockName("dynamodb.update").mockReturnValueOnce({
        promise: () => new Promise<void>((resolve) => resolve()),
    });

    const sns = new AWS.SNS({ apiVersion: "2010-03-31" });
    sns.publish = jest.fn().mockName("sns.publish").mockReturnValue({
        promise: () => new Promise<void>((resolve) => resolve()),
    });

    const shop = {
        data: {
            shop: {
                county_taxes: null,
                domain: "example.com",
                email: "owner@example.myshopify.com",
                name: "My Store",
                source: "partner",
                tax_shipping: null,
                taxes_included: null,
                timezone: "Australia/Sydney",
            },
        },
    };

    fetch.resetMocks();
    fetch.mockResponseOnce(JSON.stringify(shop));

    const result = await handlerAsync(
        event,
        dynamodb,
        sns,
        // @ts-ignore
        fetch,
    );

    expect(result).toBeTruthy();
    expect(fetch).toBeCalledWith(
        "https://example.myshopify.com/admin/api/graphql.json",
        {
            body: GetShopSettingsQueryGQL,
            headers: {
                "Accept": "application/json",
                "Content-Type": "application/graphql",
                "X-Shopify-Access-Token": "accessToken",
            },
            method: "POST",
        },
    );
    expect(dynamodb.update).toBeCalledWith({
        ExpressionAttributeNames: {
            "#P0": "domain",
            "#P1": "email",
            "#P2": "name",
            "#P3": "source",
            "#P4": "timezone",
        },
        ExpressionAttributeValues: {
            ":P0": "example.com",
            ":P1": "owner@example.myshopify.com",
            ":P2": "My Store",
            ":P3": "partner",
            ":P4": "Australia/Sydney",
        },
        Key: {
            shopDomain: "example.myshopify.com",
        },
        TableName: "shops",
        UpdateExpression: "SET #P0 = :P0, #P1 = :P1, #P2 = :P2, #P3 = :P3, #P4 = :P4",
    });
    expect(sns.publish).toBeCalledWith({
        // tslint:disable-next-line:max-line-length
        Message: "{\"data\":{\"county_taxes\":null,\"domain\":\"example.com\",\"email\":\"owner@example.myshopify.com\",\"name\":\"My Store\",\"source\":\"partner\",\"tax_shipping\":null,\"taxes_included\":null,\"timezone\":\"Australia/Sydney\"},\"event\":\"app/installed\",\"shopDomain\":\"example.myshopify.com\"}",
        TopicArn: "app_install_topic",
    });
});
