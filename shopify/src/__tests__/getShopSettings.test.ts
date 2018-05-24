import * as AWS from "aws-sdk";
import * as fetch from "jest-fetch-mock";

import { handlerAsync } from "../getShopSettings";
import { IOAuthCompleteStepFunction } from "../interfaces";

import * as GetShopSettingsQueryGQL from "../graphql/GetShopSettingsQuery.graphql";

beforeAll(() => {
    process.env.SHOPS_TABLE = "shops";
});

afterAll(() => {
    delete process.env.SHOPS_TABLE;
});

test("Happy path", async () => {
    const event: IOAuthCompleteStepFunction = {
        accessToken: "accessToken",
        shopDomain: "example.myshopify.com",
    };

    const dynamodb = new AWS.DynamoDB.DocumentClient();
    dynamodb.update = jest.fn().mockName("dynamodb.update").mockReturnValueOnce({
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
        // @ts-ignore
        fetch,
    );

    expect(result).toEqual(event);
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
});
