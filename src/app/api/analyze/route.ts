import { NextRequest, NextResponse } from "next/server";
import {
  detectAgeFromCV,
  detectGenderFromCV,
  evaluateSkillInCV,
} from "@/lib/cvEngine";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      fullName = "Yeni Aday",
      rawText = "",
      requiredSkills = ["C++", "Java"],
      apiKey = "",
    } = body;

    // 1. Run our deterministic 5-Layer Gender & 4-Layer Age Engine first
    const localGender = detectGenderFromCV(fullName, rawText);
    const localAge = detectAgeFromCV(rawText);
    const localSkills = requiredSkills.map((sk: string) =>
      evaluateSkillInCV(sk, rawText)
    );

    const effectiveKey = apiKey || process.env.GEMINI_API_KEY || "";

    // 2. If a Gemini API key is provided, enrich with LLM deep reasoning
    if (effectiveKey) {
      const prompt = `Sen kurumsal bir İK ve CV İstihbarat Yapay Zekasısın. Aşağıdaki CV metnini analiz et ve JSON formatında döndür:
Aranan Yetenekler: ${requiredSkills.join(", ")}
Aday Adı: ${fullName}
CV Metni:
${rawText}

JSON Şeması:
{
  "gender": "Kadın" | "Erkek" | "Belirsiz",
  "genderConfidence": number (0-100),
  "genderReasoning": string,
  "estimatedAge": number | null,
  "ageReasoning": string,
  "executiveSummary": string
}`;

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${effectiveKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: "application/json",
            },
          }),
        }
      );

      if (geminiRes.ok) {
        const geminiData = await geminiRes.json();
        const textOut =
          geminiData?.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
        const parsedLLM = JSON.parse(textOut);

        return NextResponse.json({
          mode: "Hibrit (5-Katmanlı Kurallar + Gemini LLM Doğrulaması)",
          gender: localGender,
          age: localAge,
          skills: localSkills,
          llmVerification: parsedLLM,
        });
      }
    }

    return NextResponse.json({
      mode: "5-Katmanlı Deterministik NLP & İsim/Kronoloji Motoru",
      gender: localGender,
      age: localAge,
      skills: localSkills,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Bilinmeyen hata";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
