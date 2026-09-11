import { generateDeadlineNotifications } from "./deadline-notifications.js";

const result = await generateDeadlineNotifications();

console.log(result);

process.exit(0);