import {
  evaluateEligibility,
} from "./evaluator.js";

const student = {
  profile: {
  category: "General",
  state: "Delhi",
  dateOfBirth: null,
},

  education: [
    {
      qualification: "B.A.",
      percentage: 52,
      passingYear: 2025,
      stream: "Arts",
    },
  ],
};

const rules = [
  {
    name: "Bachelor's Degree Required",
    conditionField: "qualification",
    operator: "IN",
    expectedValue:
      "B.Voc,B.Tech,BA,BSc,BCom",
  },
  {
    name: "Minimum Percentage 60%",
    conditionField: "percentage",
    operator: ">=",
    expectedValue: "60",
  },
  {
    name: "General Category",
    conditionField: "category",
    operator: "EQUALS",
    expectedValue: "General",
  },
  {
    name: "Delhi Candidate",
    conditionField: "state",
    operator: "EQUALS",
    expectedValue: "Delhi",
  },
];

const result = evaluateEligibility(
  student,
  rules,
);

console.log(
  JSON.stringify(result, null, 2),
);