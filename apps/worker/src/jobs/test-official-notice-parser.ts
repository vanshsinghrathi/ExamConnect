import { parseOfficialNotice } from "./official-notice-parser.js";

const sampleNotice = `
EXAM NAME: SSC CGL 2026
CONDUCTING BODY: Staff Selection Commission
EXAM TYPE: Government Recruitment Examination
DESCRIPTION: Combined Graduate Level Examination
APPLICATION START: 01/09/2026
LAST DATE: 30/09/2026
EXAM DATE: 15/11/2026
POST NAME: Assistant Section Officer
POST CODE: ASO
EDUCATIONAL QUALIFICATION: Bachelor's Degree
AGE LIMIT: 18-32 years
APPLICATION URL: https://example.com/apply
`;

const result = parseOfficialNotice(sampleNotice);

console.log("Parsed official notice:");
console.log(JSON.stringify(result, null, 2));