  GNU nano 7.2                                     
const { PDFLoader } = require("@langchain/community/document_loaders/fs/pdf");
const { DocxLoader } = require("@langchain/community/document_loaders/fs/docx");
const pdfParse = require("pdf-parse");
const z = require("zod");
const { ChatPromptTemplate } = require("@langchain/core/prompts");
const { ChatOpenAI } = require("@langchain/openai");

const allowedIndustries = [
  "Technology",
  "Finance",
  "Healthcare",
  "Insurance",
  "Retail",
  "Education",
  "Government",
  "Manufacturing",
  "Telecommunications",
  "Utilities",
  "Transportation",
  "RealEstate",
  "Hospitality",
  "Construction",
  "Banking",
  "Public Administration",
  "Aviation",
  "Other",
];

const industryExperienceSchema = z.object({
  industry: z.preprocess((val) => {
    if (typeof val === "string" && !allowedIndustries.includes(val)) {
      return "Other";
    }
    return val;
  }, z.enum(allowedIndustries)),
  otherDescription: z.string().optional().describe("Description for 'Other' industry sector"),
  description: z.string().optional().describe("Description of experience in the industry"),
  yearsOfExperience: z.number().optional().describe("Years of experience in the industry"),
}).describe("Industry Experience");
const personSchema = z
.object({
  employeid: z.string().optional().default("N/A").describe("The ID of the employee"),
  name: z.string().optional().default("Unknown").describe("The name of the person"),
  email: z.string().optional().default("N/A").describe("Email address"),
  pdfURL: z.string().optional().default("N/A").describe("URL to the person's PDF CV"),
  phone: z.string().optional().default("N/A").describe("Phone number"),
  company: z.string().optional().default("N/A").describe("The company where the person currently works"),
  summary: z.string().describe("A brief summary about the person in spanish"),
  professional_experience: z
    .array(
      z.object({
        position: z.string().optional().default("N/A").describe("Position held"),
        company: z.string().optional().default("N/A").describe("Company name"),
        dateStart: z.string().optional().default("N/A").describe("Start date of employment"),
        dateEnd: z.string().optional().default("N/A").describe("End date of employment"),
        client: z.string().optional().default("N/A").describe("Client name"),
        projects: z
          .array(
            z.object({
              name: z.string().optional().default("N/A").describe("Project name"),
              description: z.string().optional().default("N/A").describe("Project description"),
              technologies_tools: z
                .array(z.string().optional().default("N/A"))
                .optional()
                .describe("Technologies and tools used"),
            }),
          )
          .optional()
          .default([])
          .describe("Projects involved"),
        responsibilities: z
          .array(z.string().optional().default("N/A"))
          .optional()
          .default([])
          .describe("List of responsibilities"),
        methodology: z
          .array(z.string().optional().default("N/A"))
          .optional()
          .default([])
          .describe("Methodologies followed"),
      }),
    )
    .optional()
    .default([])
    .describe("Professional experience"),
  education: z
    .array(
      z.object({
        degree: z.string().optional().default("N/A").describe("The degree obtained"),
        institution: z.string().optional().default("N/A").describe("The institution name"),
        year: z.union([z.string(), z.number(), z.null()]).optional().default("N/A").describe("Year of graduation"),
      }),
    )
    .optional()
    .default([])
    .describe("Educational background"),
  certifications: z
    .array(
      z.object({
        title: z.string().optional().default("N/A").describe("Title of the certification"),
        institution: z.string().optional().default("N/A").describe("Certifying institution"),
        year: z.union([z.string(), z.number(), z.null()]).optional().default("N/A").describe("Year of certification"),
      }),
    )
    .optional()
    .default([])
    .describe("Professional certifications"),
  additional_training: z
    .array(
      z.object({
        title: z.string().optional().default("N/A").describe("Title of the training"),
        details: z.string().optional().default("N/A").describe("Additional details about the training"),
      }),
    )
    .optional()
    .default([])
    .describe("Additional training"),
  languages: z
    .array(
      z.object({
        name: z.string().optional().default("N/A").describe("Language name"),
        level: z.string().optional().default("N/A").describe("Proficiency level"),
      }),
    )
    .optional()
    .default([])
    .describe("Language proficiencies"),
  skills: z
    .object({
      technical: z
        .array(
          z.object({
            name: z.string().optional().default("N/A").describe("Technical skill name"),
            years: z.number().optional().default(0).describe("Years of experience"),
          })
        )
        .optional()
        .default([])
        .describe("Technical skills"),
      soft: z.array(z.string().optional().default("N/A")).optional().default([]).describe("Soft skills"),
    })
    .optional()
    .default({ technical: [], soft: [] })
    .describe("Skills"),
  industry_experience: z
    .array(industryExperienceSchema)
    .optional()
    .describe("Experience across different industries"),
})
.describe("Comprehensive CV Information");


const peopleSchema = z.object({
  people: z.array(personSchema),
});

/*const SYSTEM_PROMPT_TEMPLATE_BASE = `You are an expert extraction algorithm.
Only extract relevant information from the text.
The industry experience should be calculated regarding the customer industry sector.
If you do not know the value of an attribute asked to extract, you may omit the attribute's value.
The next values should be inserted in the json output in the specific placeholders:
The pdfURL is {{pdfURL}} and the EmployeeId is {{EmployeeId}}.`;*/

const SYSTEM_PROMPT_TEMPLATE_BASE = `
You are an expert in information extraction.
Your task is to extract all relevant information from the Resume, focusing on technological skills, methodologies, and other critical attributes for technic>
Please ensure the following:

1. Extract and clearly list technological skills and tools used.
2. If a field is not available or not specified in the document:
   - For string/text fields, use the value "sin especificar".
   - For numeric fields, use "0".
   - **Never use "null", "undefined", or empty values in any section of the JSON.**
3. If a field or value could violate Azure OpenAI's content management policy (e.g., sensitive personal data or confidential information), completely omit t>
4. Identify the years of experience for each technological skill. If the years of experience are not directly specified in the document, calculate them base>
5. Identify and document the methodologies followed, along with the years of experience in each. If the years of experience are not directly specified in th>
6. Calculate industry experience based on the customer's industry sector and provide this information. If no specific industry is listed, categorize the exp>
7. All content on the CV must be in Spanish, except for the names of companies and study or certification centers. Everything else must be in Spanish.
8. Extract other relevant professional information such as positions held, company names, project details, responsibilities, education, certifications, addi>
9. Extract technological skills as an array of objects with "name" and "years".
Example:
"skills":{{
  "technical": [
    {{ "name": "Java", "years": 5 }},
    {{ "name": "Angular", "years": 3 }}
  ],
  "soft": ["Liderazgo", "Comunicación"]
}}

If any attribute value is unknown or not available, you may omit that attribute's value from the output.


The extracted information should be inserted into the JSON output using the specific placeholders provided pdfURL: {{pdfURL}} and EmployeeId: {{EmployeeId}}>
{{
  "people": [
    {{
      "employeid": "{{EmployeeId}}",
      "name": "value",
      "email": "value",
      "pdfURL": "{{pdfURL}}",
      "phone": "value",
      "company": "value",
      "summary": "value",
      "professional_experience": [ ... ],
      "education": [ ... ],
      "certifications": [ ... ],
      "additional_training": [ ... ],
      "languages": [ ... ],
      "skills":{{ "technical": [ ... ], "soft": [ ... ] }} ,
      "industry_experience": [ ... ]
    }}
  ]
}}

Replace the sample values with the extracted information accordingly.

If an executive summary is not found in the CV, please generate one in Spanish based on the available information in the document.

Please ensure the output is accurate, well-structured, and complete where possible. Additionally, verify that there are no spelling errors in Spanish, and i>
`;

// Simple hash function to generate a number from a string
function hashStringToNumber(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash); // Ensure the hash is positive
}

async function loadDocument(docPath) {
  /** STEP ONE: LOAD DOCUMENT */
  const response = await fetch(docPath);
  const blob = await response.blob();
  let docs = [];

  try {
    // Attempt to load as PDF
    const pdfLoader = new PDFLoader(blob, {
      splitPages: false,
    });
    docs = await pdfLoader.load();
  } catch (pdfError) {
    console.warn('Failed to load as PDF, attempting to load as Word document:', pdfError);
    try {
      // Attempt to load as Word document
      console.log("Attempting to load as Word document:", docPath);
      const loader = new DocxLoader(blob);

      docs = await loader.load();

    } catch (wordError) {
      console.error('Failed to load as Word document:', wordError);
      throw new Error('Unsupported document format or failed to load document');
    }
  }

  return docs;
// Cambio 2: Normalizador robusto para "skills.technical"
function normalizeTechnicalSkills(data) {
  data.people?.forEach(person => {
    if (Array.isArray(person.skills?.technical)) {
      person.skills.technical = person.skills.technical.map(skill =>
        typeof skill === "string" ? { name: skill, years: 0 } : skill
      );
    }
  });
  return data;
}

async function handler(req, res) {
  if (req.method === "POST") {
    try {
      let { pdfpath, nifparam, docname } = req.body;

      /** STEP ONE: LOAD DOCUMENT */
      /*const response = await fetch(pdfpath);
      const blob = await response.blob();
      const loader = new PDFLoader(blob, {
        splitPages: false,
      });

      const docs = await loader.load();*/
      const docs = await loadDocument(pdfpath);

      if (docs.length === 0) {
        console.log("No documents found.");
        return res.status(400).json({ message: "No documents found" });
      }

       // Generate a random number related to the docname
      const randomEmployeeId = hashStringToNumber(docname);

      // Replace the placeholders with actual values
      const SYSTEM_PROMPT_TEMPLATE = SYSTEM_PROMPT_TEMPLATE_BASE.replace(
        "{{pdfURL}}",
        pdfpath,
      ).replace("{{EmployeeId}}", randomEmployeeId);
      const prompt = ChatPromptTemplate.fromMessages([
        ["system", SYSTEM_PROMPT_TEMPLATE],
        ["human", docs[0].pageContent],
      ]);


      const llm = new ChatOpenAI({
        azureOpenAIApiKey: process.env.AZURE_OPENAI_API_KEY,
        azureOpenAIApiInstanceName: process.env.AZURE_OPENAI_ENDPOINT,
        azureOpenAIApiDeploymentName: process.env.AZURE_OPENAI_DEPLOYMENT_NAME,
        azureOpenAIApiVersion: process.env.AZURE_OPENAI_API_VERSION, // p.ej.: "2023-03-15-preview"
        modelName: process.env.AZURE_MODEL_NAME,
        temperature: 0,
      });

// Este es el texto del CV (puedes truncarlo si es muy largo)
console.log('==== TEXT SENT TO LLM ====');
console.log(docs[0].pageContent.substring(0, 3000)); // Primeros 3.000 caracteres

// Este es el system prompt realmente usado
console.log('==== SYSTEM PROMPT SENT TO LLM ====');
console.log(SYSTEM_PROMPT_TEMPLATE);

// (opcional) El prompt total enviado (system+user)
console.log('==== FULL PROMPT OBJECT ====');
console.log(JSON.stringify(
  [
    {role: "system", content: SYSTEM_PROMPT_TEMPLATE},
    {role: "user", content: docs[0].pageContent.substring(0, 3000)}
  ],
  null, 2
));



      const extractionRunnable = prompt.pipe(
        llm.withStructuredOutput(peopleSchema, { name: "people" }),
      );

      const rawExtract = await extractionRunnable.invoke({
        text: docs[0].pageContent,
      });

      // Cambio 3: Aplicar normalización antes del parseo final
      const extract = peopleSchema.parse(normalizeTechnicalSkills(rawExtract));

      //console.log(JSON.stringify(extract, null, 2));
      //console.log("Successfully extracted");

      return res.status(200).json(extract);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Internal Server Error" });
    }
  } else {
    res.status(405).json({ message: "Method not allowed" });
  }
}
module.exports = handler; // Export the handler function

const express = require('express');
const app = express();

app.use(express.json());
app.post('/completions', handler);

app.listen(3555, () => {
  console.log('Servidor corriendo en el puerto 3555');
});






