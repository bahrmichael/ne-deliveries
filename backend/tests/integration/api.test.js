// @ts-ignore
const { data, api } = require("@serverless/cloud"); // eslint-disable-lin
const { v4: uuid } = require('uuid');

describe("Appraisal", () => {

    test("should be able to get a result", async () => {
        const { body } = await api.post(`/appraisal`).invoke({text: 'Tritanium x1000'});

        const { price, volume, items } = body;
        expect(price).toBeDefined();
        expect(volume).toBe(10);
        expect(items.length).toBe(1);
        const { amount, itemType } = items[0];
        expect(amount).toBe(100);
        expect(itemType.name).toBe('Tritanium');
    });
});

describe("Change orders", () => {
    let order;

    beforeEach(async() => {
        const { body } = await api.post("/orders/").invoke({
            name: "Something to do",
        });
        order = body;
    })

    test("should have initial status pending", async() => {
        const { body: getResult } = await api.get(`/orders/${order.id}`).invoke();
        expect(getResult.status).toBe('pending');
    });

    test("should update the status from pending to in_progress", async() => {
        const { body: getBeforeUpdate } = await api.get(`/orders/${order.id}`).invoke();
        expect(getBeforeUpdate.status).toBe('pending');

        const { body: updateResult } = await api.put(`/orders/${order.id}`).invoke({status: 'in_progress'});
        expect(updateResult.status).toBe('in_progress');

        const { body: getAfterUpdate } = await api.get(`/orders/${order.id}`).invoke();
        expect(getAfterUpdate.status).toBe('in_progress');
    });

    test.skip("should not allow updating status that's not pending", async() => {
        const { body: updateResult } = await api.put(`/orders/${order.id}`).invoke({status: 'in_progress'});
        expect(updateResult.status).toBe('in_progress');

        const { body: getAfterUpdate } = await api.get(`/orders/${order.id}`).invoke();
        expect(getAfterUpdate.status).toBe('in_progress');

        const {status} = await api.put(`/orders/${order.id}`).invoke({status: 'pending'});
        expect(status).toBe(400);
    });

    // todo: waiting for help
    test.skip("should delete the order", async() => {
        await api.delete(`/orders/${order.id}`).invoke();

        const { body: getAfterDelete } = await api.get(`/orders/${id}`).invoke();
        expect(getAfterDelete).toBeUndefined();
    });

    afterEach(async () => {
        await data.remove(`order:${order.id}`);
    });
});

describe("Read orders", () => {

    const orders = [{
        id: uuid(),
        name: "Something to do",
        status: 'pending',
    }, {
        id: uuid(),
        name: "Something to do",
        status: 'in_progress',
    }, {
        id: uuid(),
        name: "Something to do",
        status: 'finished',
    }];

    beforeAll(async () => {
        for (const order of orders) {
            await data.set(`order:${order.id}`, order, {
                label1: order.status,
            });
        }
    });

    afterAll(async () => {
        for (const order of orders) {
            await data.remove(`order:${order.id}`);
        }
    });

    test("should get individual order" , async () => {
        const { id, status } = orders[0];
        const { body } = await api.get(`/orders/${id}`).invoke();
        expect(body.id).toBeDefined();
        expect(body.id).toEqual(id);
        expect(body.status).toBe(status);
    });

    test("should get all orders", async () => {
        const { body } = await api.get("/orders").invoke();

        expect(body).toEqual({
            items: orders.sort((a, b) => a.id.localeCompare(b.id)),
        });
    });

    test.each(['pending', 'in_progress', 'finished'])("should get all orders with status %s", async (status) => {
        const { body } = await api.get(`/orders?status=${status}`).invoke();

        expect(body).toEqual({
            items: orders.filter((o) => o.status === status),
        });
    });
});