import { createMicroAppProjectAction } from './src/app/actions/micro-app';

async function test() {
    try {
        console.log("Testing project creation...");
        const res = await createMicroAppProjectAction("Test Project from AI Agent");
        console.log("Result:", JSON.stringify(res, null, 2));
    } catch (e: any) {
        console.error("Test failed:", e.message);
    }
}

test();
