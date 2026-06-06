import { executeQuestionnaire } from './src/packages/ai-engine/questionnaire-engine';
import { QuestionnaireSubmission } from './src/packages/ai-engine/questionnaire-engine/types';

async function test() {
  const mockSubmission: QuestionnaireSubmission = {
    age: "35", // Should parse to a number
    biologicalSex: "male", // Should normalize to MALE
    primaryConcerns: ["hair thinning", "receding hairline", 123], // Should filter out the number
    onsetDurationMonths: 24,
    scalpCondition: "OILY",
    stressLevel: "high", // Should normalize to HIGH
    dietQuality: "average", // Unrecognized, should fallback to UNKNOWN
    smokingStatus: "true", // Should parse to boolean true
    familyHistoryOfHairLoss: true,
    unknownField: "this should be ignored", // Should not be in output
    labMarkerSummary: {
      "iron": "low",
      "vitaminD": "normal",
      "ignoreMe": 42 // Should be ignored since it's not a string
    }
  };

  console.log("Starting Questionnaire Engine Test...\n");
  const result = await executeQuestionnaire(mockSubmission);
  
  console.log("=== 📥 Raw Input ===");
  console.log(JSON.stringify(mockSubmission, null, 2));
  
  console.log("\n=== 📤 Processed Clinical Profile ===");
  console.log(JSON.stringify(result, null, 2));
}

test().catch(console.error);
