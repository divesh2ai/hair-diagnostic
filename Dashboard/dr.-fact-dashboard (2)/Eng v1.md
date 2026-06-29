### Ran for 71s

### lightbulbThought for 71 seconds

# **HairOS (Dr FACT) — Enterprise Engineering Specification**

### **System Architecture & Technical Design Blueprint** **Target Environment:** Next.js App Router • Supabase Core (PostgreSQL, Auth, RLS, Storage, Realtime) • Prisma ORM • Vercel • Gemini API • HeyGen Video API • Tailwind CSS • shadcn/ui

### ---

## **1\. Domain Model**

### The HairOS (Dr FACT) platform is architected around a strict multi-tenant schema where the identity layer is separated from membership. This guarantees enterprise-grade tenant isolation, granular access control, and seamless management of multi-location clinical networks.

### codeCode

### \+\------------------+       \+---------------+

### |   Organization   | 1\---\* |    Clinic     |

### \+\------------------+       \+---------------+

###         |                          |

###         | 1                        | 1

###         \*                          \*

### \+\------------------+       \+---------------+

### |   User (Auth)    | 1\---\* | ClinicMember  |

### \+\------------------+       \+---------------+

### **Core Domain Entities**

#### **1\. Organization (organizations)**

* ### **Purpose:** Represents the top-level legal and billing entity. An organization acts as the primary billing boundary and owns one or more physical or virtual clinics.

* ### **Relationships:**

  * ### One-to-Many with clinics.

  * ### One-to-Many with clinic\_members (indirectly via users belonging to the org).

* ### 

* ### **Business Rules:** Must have an active subscription state to allow clinic operations. Suspension of an organization propagates suspension down to all clinics and members.

* ### **Lifecycle:** PENDING 

* ###  ACTIVE 

* ###  SUSPENDED 

* ###  ARCHIVED.

#### **2\. Clinic (clinics)**

* ### **Purpose:** Represents a physical or virtual clinic location where patients are managed, diagnostics are captured, and inventory is stored.

* ### **Relationships:**

  * ### Many-to-One with organizations.

  * ### One-to-Many with clinic\_members.

  * ### One-to-Many with patients.

  * ### One-to-Many with inventory.

* ### 

* ### **Business Rules:** All database queries must isolate data at the clinic boundary using Supabase Row Level Security (RLS) policies targeting the active clinic session.

#### **3\. User Identity (users)**

* ### **Purpose:** System-wide identity matching the Supabase Auth system. Stored outside tenant boundaries but linked to organizations and clinics via memberships.

* ### **Relationships:**

  * ### One-to-Many with clinic\_members.

  * ### One-to-One with patients (if a patient logs in).

* ### 

#### **4\. Clinic Member (clinic\_members)**

* ### **Purpose:** Intersection entity mapping users to specific clinics with specific roles. Supports a single user possessing multiple access levels across distinct clinics.

* ### **Relationships:**

  * ### Many-to-One with users.

  * ### Many-to-One with clinics.

* ### 

* ### **Business Rules:** Custom claims in jwt are synced with active membership roles to enforce API and UI routing boundaries.

### ---

## **2\. Complete Database Design**

### This schema is designed to map cleanly to PostgreSQL via Prisma. All primary keys use UUIDv4. All tables containing tenant or clinical data include clinic\_id to enforce Row Level Security.

### **Table Inventory**

#### **organizations**

* ### **Purpose:** Top-level multi-clinic enterprise container.

* ### **Fields:**

  * ### id (UUID, PK)

  * ### name (VARCHAR, Not Null)

  * ### slug (VARCHAR, Unique, Not Null)

  * ### status (VARCHAR, Default: 'ACTIVE')

  * ### subscription\_tier (VARCHAR, Not Null)

  * ### created\_at (TIMESTAMP)

  * ### updated\_at (TIMESTAMP)

* ### 

* ### **Indexes:** Unique index on slug.

#### **clinics**

* ### **Purpose:** Distinct physical/logical clinical locations.

* ### **Fields:**

  * ### id (UUID, PK)

  * ### organization\_id (UUID, FK, Not Null)

  * ### name (VARCHAR, Not Null)

  * ### timezone (VARCHAR, Default: 'UTC')

  * ### is\_active (BOOLEAN, Default: true)

  * ### settings (JSONB \- stores custom intake settings, local configurations)

  * ### created\_at (TIMESTAMP)

* ### 

* ### **Indexes:** Index on organization\_id.

#### **users**

* ### **Purpose:** System users (Super Admins, Clinic Admins, Doctors, staff).

* ### **Fields:**

  * ### id (UUID, PK, matches Supabase Auth uid)

  * ### email (VARCHAR, Unique, Not Null)

  * ### first\_name (VARCHAR)

  * ### last\_name (VARCHAR)

  * ### avatar\_url (VARCHAR)

  * ### is\_super\_admin (BOOLEAN, Default: false)

  * ### created\_at (TIMESTAMP)

* ### 

* ### **Indexes:** Unique index on email.

#### **clinic\_members**

* ### **Purpose:** Junction table defining user access permissions per clinic.

* ### **Fields:**

  * ### id (UUID, PK)

  * ### clinic\_id (UUID, FK, Not Null)

  * ### user\_id (UUID, FK, Not Null)

  * ### role (VARCHAR \- 'CLINIC\_ADMIN', 'DOCTOR')

  * ### is\_active (BOOLEAN, Default: true)

  * ### heygen\_avatar\_id (VARCHAR, Nullable \- used for doctor's video avatar)

  * ### created\_at (TIMESTAMP)

* ### 

* ### **Indexes:** Unique constraint on (clinic\_id, user\_id).

#### **patients**

* ### **Purpose:** Demographic and clinical master record for patients.

* ### **Fields:**

  * ### id (UUID, PK)

  * ### clinic\_id (UUID, FK, Not Null)

  * ### user\_id (UUID, FK, Nullable \- present if registered for portal)

  * ### first\_name (VARCHAR, Not Null)

  * ### last\_name (VARCHAR, Not Null)

  * ### email (VARCHAR, Nullable)

  * ### phone (VARCHAR, Nullable)

  * ### date\_of\_birth (DATE)

  * ### gender (VARCHAR)

  * ### external\_qr\_code (VARCHAR, Unique, Nullable)

  * ### created\_at (TIMESTAMP)

* ### 

* ### **Indexes:** Composite index on (clinic\_id, last\_name), unique index on external\_qr\_code.

#### **assessments**

* ### **Purpose:** Trichology assessment, hair analysis, and intake telemetry records.

* ### **Fields:**

  * ### id (UUID, PK)

  * ### clinic\_id (UUID, FK, Not Null)

  * ### patient\_id (UUID, FK, Not Null)

  * ### intake\_responses (JSONB \- answers to hair loss duration, history, and medical questions)

  * ### ai\_pre\_analysis (JSONB \- raw metrics computed by Gemini vision model)

  * ### risk\_level (VARCHAR \- 'LOW', 'MEDIUM', 'HIGH')

  * ### status (VARCHAR \- 'PENDING\_IMAGES', 'AI\_PROCESSING', 'READY\_FOR\_REVIEW', 'COMPLETED')

  * ### created\_by\_id (UUID, FK \- Clinic member or NULL if self-intake)

  * ### created\_at (TIMESTAMP)

* ### 

* ### **Indexes:** Index on (clinic\_id, status), index on patient\_id.

#### **assessment\_images**

* ### **Purpose:** Scalp trichoscopy and macro photograph files stored in Supabase Storage.

* ### **Fields:**

  * ### id (UUID, PK)

  * ### assessment\_id (UUID, FK, Not Null)

  * ### view\_type (VARCHAR \- 'VERTEX', 'CROWN', 'FRONTAL', 'TEMPORAL', 'MICROSCOPIC')

  * ### storage\_path (VARCHAR, Not Null \- pointer to Supabase bucket file)

  * ### confidence\_score (DECIMAL \- image quality check score)

  * ### created\_at (TIMESTAMP)

* ### 

* ### **Indexes:** Index on assessment\_id.

#### **reports**

* ### **Purpose:** Clinical diagnostic reports generated by AI and finalized by the doctor.

* ### **Fields:**

  * ### id (UUID, PK)

  * ### clinic\_id (UUID, FK, Not Null)

  * ### assessment\_id (UUID, FK, Unique, Not Null)

  * ### doctor\_id (UUID, FK, Nullable \- assigned validating physician)

  * ### ai\_diagnosis\_draft (JSONB)

  * ### final\_diagnosis (JSONB)

  * ### ai\_recommended\_treatment (JSONB)

  * ### final\_treatment\_plan (JSONB)

  * ### status (VARCHAR \- 'DRAFT', 'UNDER\_REVIEW', 'APPROVED', 'SENT')

  * ### created\_at (TIMESTAMP)

* ### 

* ### **Indexes:** Unique index on assessment\_id, index on (clinic\_id, status).

#### **report\_reviews**

* ### **Purpose:** Logs detailing changes made by the doctor compared to AI suggestions.

* ### **Fields:**

  * ### id (UUID, PK)

  * ### report\_id (UUID, FK, Not Null)

  * ### reviewer\_id (UUID, FK, Not Null \- Doctor member)

  * ### agreement\_score (DECIMAL \- percentage of matching tokens/selections between AI and Doctor)

  * ### overrides (JSONB \- exact key-value pairs corrected by Doctor)

  * ### override\_reason (TEXT)

  * ### created\_at (TIMESTAMP)

* ### 

* ### **Indexes:** Index on report\_id.

#### **treatment\_catalog**

* ### **Purpose:** Global catalog of validated treatment components, hair serums, compounds, and kits.

* ### **Fields:**

  * ### id (UUID, PK)

  * ### name (VARCHAR, Not Null)

  * ### sku (VARCHAR, Unique, Not Null)

  * ### description (TEXT)

  * ### category (VARCHAR \- 'TOPICAL', 'ORAL', 'PROCEDURAL', 'LED')

  * ### base\_price (DECIMAL)

  * ### is\_active (BOOLEAN, Default: true)

* ### 

* ### **Indexes:** Unique index on sku.

#### **inventory**

* ### **Purpose:** Tracks current stock levels of treatment items per physical clinic.

* ### **Fields:**

  * ### id (UUID, PK)

  * ### clinic\_id (UUID, FK, Not Null)

  * ### product\_id (UUID, FK, Not Null \- references treatment\_catalog)

  * ### quantity\_on\_hand (INTEGER, Not Null)

  * ### reorder\_point (INTEGER)

  * ### location\_rack (VARCHAR)

  * ### updated\_at (TIMESTAMP)

* ### 

* ### **Indexes:** Unique constraint on (clinic\_id, product\_id).

#### **orders**

* ### **Purpose:** Patient clinical prescription orders generated by treatment plans.

* ### **Fields:**

  * ### id (UUID, PK)

  * ### clinic\_id (UUID, FK, Not Null)

  * ### patient\_id (UUID, FK, Not Null)

  * ### report\_id (UUID, FK, Nullable)

  * ### status (VARCHAR \- 'PENDING\_APPROVAL', 'DISPENSING', 'COMPLETED', 'SHIPPED', 'CANCELLED')

  * ### total\_amount (DECIMAL)

  * ### created\_at (TIMESTAMP)

* ### 

* ### **Indexes:** Index on (clinic\_id, status).

#### **order\_items**

* ### **Purpose:** Individual product items inside a prescription order.

* ### **Fields:**

  * ### id (UUID, PK)

  * ### order\_id (UUID, FK, Not Null)

  * ### product\_id (UUID, FK, Not Null \- references treatment\_catalog)

  * ### quantity (INTEGER, Not Null)

  * ### unit\_price (DECIMAL, Not Null)

* ### 

* ### **Indexes:** Index on order\_id.

#### **videos**

* ### **Purpose:** Interactive HeyGen-powered personalized avatar videos explaining diagnosis to patients.

* ### **Fields:**

  * ### id (UUID, PK)

  * ### clinic\_id (UUID, FK, Not Null)

  * ### report\_id (UUID, FK, Unique, Not Null)

  * ### heygen\_video\_id (VARCHAR, Nullable)

  * ### script\_content (TEXT, Not Null)

  * ### status (VARCHAR \- 'SCRIPT\_PENDING\_APPROVAL', 'GENERATING', 'READY', 'FAILED')

  * ### video\_url (VARCHAR, Nullable)

  * ### failure\_reason (TEXT)

  * ### created\_at (TIMESTAMP)

* ### 

* ### **Indexes:** Unique index on report\_id.

#### **appointments**

* ### **Purpose:** In-clinic photography and follow-up consultation bookings.

* ### **Fields:**

  * ### id (UUID, PK)

  * ### clinic\_id (UUID, FK, Not Null)

  * ### patient\_id (UUID, FK, Not Null)

  * ### doctor\_id (UUID, FK, Nullable)

  * ### scheduled\_time (TIMESTAMP, Not Null)

  * ### type (VARCHAR \- 'INITIAL\_ASSESSMENT', 'FOLLOW\_UP\_PHOTO', 'CONSULTATION')

  * ### status (VARCHAR \- 'SCHEDULED', 'CHECKED\_IN', 'COMPLETED', 'NOSHOW')

  * ### created\_at (TIMESTAMP)

* ### 

* ### **Indexes:** Index on (clinic\_id, scheduled\_time, status).

#### **support\_tickets**

* ### **Purpose:** Tracks human handoff interactions and user-support issues.

* ### **Fields:**

  * ### id (UUID, PK)

  * ### clinic\_id (UUID, FK, Not Null)

  * ### patient\_id (UUID, FK, Not Null)

  * ### status (VARCHAR \- 'PENDING', 'ACTIVE', 'RESOLVED')

  * ### priority (VARCHAR \- 'LOW', 'MEDIUM', 'HIGH')

  * ### reason (VARCHAR)

  * ### last\_message (TEXT)

  * ### assigned\_agent\_id (UUID, FK, Nullable)

  * ### created\_at (TIMESTAMP)

* ### 

* ### **Indexes:** Index on (clinic\_id, status).

#### **audit\_logs**

* ### **Purpose:** Immutable medical compliance trails mapping clinic events.

* ### **Fields:**

  * ### id (UUID, PK)

  * ### clinic\_id (UUID, FK, Nullable)

  * ### user\_id (UUID, FK, Nullable \- operator executing change)

  * ### event\_type (VARCHAR, Not Null \- e.g., 'ASSESSMENT\_OVERRIDE')

  * ### table\_name (VARCHAR)

  * ### record\_id (UUID)

  * ### old\_data (JSONB)

  * ### new\_data (JSONB)

  * ### ip\_address (VARCHAR)

  * ### created\_at (TIMESTAMP)

* ### 

* ### **Indexes:** Index on (clinic\_id, event\_type), index on created\_at.

### ---

## **3\. Relationship Diagram**

### The simplified ERD shows foreign keys linking back to organizations and clinics, establishing the hard boundaries necessary for secure tenant lookup isolation.

### codeCode

### \+\------------------+

### |  organizations   |

### \+\------------------+

###        | 1

###        |

###        |  \*

### \+\------------------+         \+------------------+         \+------------------+

### |     clinics      | 1\-----\* |  clinic\_members  | \*-----1 |      users       |

### \+\------------------+         \+------------------+         \+------------------+

###        | 1                           | 1 (Optional as physician)

###        |                             |

###        |  \*                          |  \*

###        |                     \+\------------------+         \+------------------+

###        \+\-------------------\* |     reports      | 1-----1 |      videos      |

###        | 1                   \+\------------------+         \+------------------+

###        |                             | 1

###        |                             |

###        |  \*                          |  1

### \+\------------------+         \+------------------+

### |   assessments    | 1\-----1 |  report\_reviews  |

### \+\------------------+         \+------------------+

###        | 1

###        |

###        |  \*

### \+\------------------+

### |assessment\_images |

### \+\------------------+

### ---

## **4\. Workflow State Machines**

### These strict state machines govern HairOS transitions. Only defined transitions are valid. Any violations reject at the API layer.

### **1\. Assessment Workflow**

### codeCode

### \[PENDING\_IMAGES\] \---\> \[AI\_PROCESSING\] \---\> \[READY\_FOR\_REVIEW\] \---\> \[COMPLETED\]

* ### **Allowed Transitions:**

  * ### PENDING\_IMAGES 

  * ###  AI\_PROCESSING: Triggered automatically when required macro/micro scalp images are uploaded.

  * ### AI\_PROCESSING 

  * ###  READY\_FOR\_REVIEW: Complete payload processed by Gemini API, diagnostic structured JSON compiled.

  * ### READY\_FOR\_REVIEW 

  * ###  COMPLETED: Assessment mapped directly to approved Report by Doctor.

* ### 

* ### **Invalid Transitions:** PENDING\_IMAGES 

* ###  READY\_FOR\_REVIEW, READY\_FOR\_REVIEW 

* ###  AI\_PROCESSING (unless explicit regenerate request).

* ### **Terminal State:** COMPLETED.

### **2\. Report Workflow**

### codeCode

### \[DRAFT\] \---\> \[UNDER\_REVIEW\] \---\> \[APPROVED\] \---\> \[SENT\]

* ### **Allowed Transitions:**

  * ### DRAFT 

  * ###  UNDER\_REVIEW: AI compiles draft; assigned to a Doctor.

  * ### UNDER\_REVIEW 

  * ###  APPROVED: Doctor accepts or overrides diagnostics and signs off.

  * ### APPROVED 

  * ###  SENT: Delivered to Patient Portal, triggering notification channels.

* ### 

* ### **Terminal State:** SENT.

### **3\. Video Workflow**

### codeCode

### \[SCRIPT\_PENDING\_APPROVAL\] \---\> \[GENERATING\] \---\> \[READY\]

###                                       |

###                                       \+\--------\> \[FAILED\]

* ### **Allowed Transitions:**

  * ### SCRIPT\_PENDING\_APPROVAL 

  * ###  GENERATING: Doctor reviews & edits script text, clicks "Generate Video" button.

  * ### GENERATING 

  * ###  READY (via HeyGen webhook indicating video completion).

  * ### GENERATING 

  * ###  FAILED (via error catch or retry limit exhaustion).

  * ### FAILED 

  * ###  GENERATING (re-trigger queue).

* ### 

* ### **Terminal State:** READY.

### **4\. Order Workflow**

### codeCode

### \[PENDING\_APPROVAL\] \---\> \[DISPENSING\] \---\> \[SHIPPED\] \---\> \[COMPLETED\]

###         |

###         \+\--------\> \[CANCELLED\]

* ### **Allowed Transitions:**

  * ### PENDING\_APPROVAL 

  * ###  DISPENSING: Doctor-prescribed treatment plan approved. Deducts quantities from inventory.

  * ### DISPENSING 

  * ###  SHIPPED: Package dispatched from local inventory or partner compounding pharmacy.

  * ### SHIPPED 

  * ###  COMPLETED: Patient receives compounding serum.

  * ### PENDING\_APPROVAL 

  * ###  CANCELLED: Order rejected.

* ### 

### **5\. Appointment Workflow**

### codeCode

### \[SCHEDULED\] \---\> \[CHECKED\_IN\] \---\> \[COMPLETED\]

###     |                  |

###     \+\------------------+---------\> \[NOSHOW\]

### **6\. Support Ticket (Human Handoff) Workflow**

### codeCode

### \[PENDING\] \---\> \[ACTIVE\] \---\> \[RESOLVED\]

* ### **Allowed Transitions:**

  * ### PENDING 

  * ###  ACTIVE: Support representative opens and claims the handoff chat.

  * ### ACTIVE 

  * ###  RESOLVED: Operator completes support resolution.

  * ### PENDING 

  * ###  RESOLVED: Quick resolution.

* ### 

### ---

## **5\. Role Permission Matrix**

### This matrix governs page access and API operations within HairOS. All checks are enforced by matching the request JWT metadata against table contents via Supabase row-level policies.

| Action | SUPER\_ADMIN | CLINIC\_ADMIN | DOCTOR | PATIENT |
| :---- | :---- | :---- | :---- | :---- |
| **Create/Modify Organization** | **C**RU**D** | Read Only | No Access | No Access |
| **Create/Modify Clinic Profile** | **C**RU**D** | R**U** | Read Only | No Access |
| **Manage Users & Membership** | **C**RU**D** | **C**RU**D** | Read Only | No Access |
| **In-Clinic Patient Intake** | No Access | **C**R**U** | **C**R**U** | No Access |
| **View Audit Logs** | **C**R | **C**R (Clinic only) | No Access | No Access |
| **Run Diagnostic Pre-analysis (AI)** | No Access | **C**R (Staff launch) | **C**R | No Access |
| **Approve / Override Report** | No Access | No Access | **C**R**U** (Sign-off) | No Access |
| **View Final Report / Video** | No Access | Read Only | Read Only | Read Only |
| **Approve Video Script & Render** | No Access | No Access | **C**R**U** | No Access |
| **Dispense Treatment Prescriptions** | No Access | R**U** (Fulfill) | **C**R**U** (Prescribe) | No Access |
| **Update Stock / Inventory Counts** | No Access | **C**RU**D** | Read Only | No Access |
| **Request Human Handoff** | No Access | Read Only | Read Only | **C**R (Client Chat) |
| **Export Health Analytics Reports** | **C**R | **C**R | Read Only | No Access |

### ---

## **6\. Dashboard Inventory**

### **1\. SUPER\_ADMIN Dashboard**

* ### **Purpose:** High-level platform monitoring, financial health, multi-tenant billing status, global operations.

* ### **Metrics (KPIs):** Total Active Organizations, Aggregate Clinics Online, Monthly Recurring Revenue (MRR), AI Accuracy Index, System Health/Uptime, Outstanding Support Escalations.

* ### **Active Queues:** Pending Clinical Onboardings, Critical System Errors.

* ### **Primary Actions:** Deploy New Clinic, Adjust Subscription Tier, View Global Platform Audit Logs, Force Global Settings Update.

* ### **Navigation:** Global Analytics, Organization Manager, Security Audit, System Config, Support Escalations.

### **2\. CLINIC\_ADMIN Dashboard**

* ### **Purpose:** Day-to-day clinic operations, local team management, supply chain, and local clinic analytics.

* ### **Metrics (KPIs):** Today's Scheduled Patients, Intake Completion Rate, Low-Stock SKUs, Average Doctor Review Cycle Time, Average Ticket Close Time.

* ### **Active Queues:** Walk-in Intake Queue, Reorder Needed Inventory.

* ### **Primary Actions:** Check-in Walk-in Patient, Dispatch Low Stock Alert, Add New Clinic Member, Export Clinic P\&L Report.

* ### **Navigation:** Clinic Staff, Patients, Inventory, Appointments, Local Logs.

### **3\. Doctor Workspace (/doctor)**

* ### **Purpose:** Core patient diagnostics workspace, AI override console, prescription and script writing workflow.

* ### **Metrics (KPIs):** My Pending Reports, Agreement Score (AI vs Self), Completed Treatments, Total Patients Under Care, Patient Satisfaction (CSAT).

* ### **Active Queues:** Assessment Queue (Awaiting Diagnosis), Script Verification Queue (HeyGen generation), Active Patient Support Handoffs.

* ### **Primary Actions:** Review AI Analysis, Approve Final Treatment, Customize Video Script, Complete Handoff Ticket.

* ### **Navigation:** Queue, Patient Records, Compound Catalog, Support Handoff, Settings.

### **4\. Patient Portal**

* ### **Purpose:** Patient dashboard to view diagnosis, watch videos, track daily hair treatment, and order refills.

* ### **Metrics (KPIs):** Treatment Adherence Rate (Streak), Days until next Photo Session, Treatment Plan Status.

* ### **Active Queues:** Daily Regimen Checklist, Refill Orders Pending.

* ### **Primary Actions:** Complete Daily Hair Routine, Order Refill Serum, Schedule Photo Follow-up, Launch Chatbot Support.

* ### **Navigation:** Diagnostics, Interactive Video, Regimen, Scheduling, Billing.

### ---

## **7\. Operational Queue Design**

### HairOS is a queue-driven operating system. Real-time updates utilize Supabase Realtime Channels to push card movements across columns instantly.

### **Queue Blueprints**

### codeCode

### \+\--------------------+      \+--------------------+      \+--------------------+      \+--------------------+

### |    Waiting Room    | \---\> |  Assessment Queue  | \---\> | AI Processing Queue| \---\> |  Ready for Review  |

### \+\--------------------+      \+--------------------+      \+--------------------+      \+--------------------+

#### **1\. Waiting Room (Reception & QR Queue)**

* ### **Trigger:** Patient checks in at physical reception desk or scans QR code.

* ### **Owner:** CLINIC\_ADMIN / Front Desk Staff.

* ### **Priority:** Medium (First-in, First-out).

* ### **Exit Conditions:** Patient profile complete, mapped to unique external\_qr\_code physical card. Passed to photographic assessment room.

#### **2\. Assessment Queue (Photography & Intake)**

* ### **Trigger:** Patient enters photo room. Intake questions answered.

* ### **Owner:** Nurse / Clinical Photographer.

* ### **Priority:** High.

* ### **Exit Conditions:** Front, Crown, Temporal, and Microscopic trichoscopic photos uploaded with minimum confidence score 

* ### .

#### **3\. AI Processing Queue (Auto-Diagnostics)**

* ### **Trigger:** Photo upload completes. Automatically generates job entry.

* ### **Owner:** System background worker / Edge Function queue.

* ### **Priority:** Low (Unattended background job).

* ### **Exit Conditions:** Gemini vision and analysis engine finishes writing payload. Generates Draft Report. Moves to Ready for Review within 45 seconds.

#### **4\. Ready for Review (Physician Review Workspace)**

* ### **Trigger:** AI Diagnostics processing ends.

* ### **Owner:** Assigned DOCTOR.

* ### **Priority:** Critical (Must clear daily).

* ### **Exit Conditions:** Doctor performs clinical validation, saves overrides (if any), approves diagnostic report.

#### **5\. Video Queue (Avatar Video Pipeline)**

* ### **Trigger:** Doctor signs off on Report.

* ### **Owner:** DOCTOR (Script review) / System Queue (Rendering).

* ### **Priority:** Medium.

* ### **Exit Conditions:** Video rendered successfully via HeyGen API, URL available. Patient notified.

#### **6\. Support Queue (Human Handoff Intervention)**

* ### **Trigger:** Patient requests support or AI detects high risk of hallucination / complex override requirement.

* ### **Owner:** Staff / DOCTOR.

* ### **Priority:** Critical.

* ### **Exit Conditions:** Manual intervention complete. Ticket resolved by doctor.

### ---

## **8\. Patient Journey**

### An end-to-end trace of a patient passing through the automated HairOS restoration lifecycle:

### codeCode

### \[Check\-in / QR\] 

###       │ (Trigger: Walk\-in scans QR at clinic entryway)

###       ▼

### \[Assessment Intake\] 

###       │ (Trigger: App answers collected, hair loss timeline specified)

###       ▼

### \[High\-Res Scalp Photography\] 

###       │ (Trigger: Trichoscope image capture at Crown, Front, Temporal)

###       ▼

### \[AI Analysis Pipeline\] 

###       │ (Trigger: Edge function processes photos via Gemini API)

###       ▼

### \[Doctor Oversight Workspace\] 

###       │ (Trigger: Physician reviews AI draft, adjusts active formulations)

###       ▼

### \[Script & Video Generation\] 

###       │ (Trigger: HeyGen synthesizes avatar speaking approved script)

###       ▼

### \[Patient Delivery & Action\] 

###       │ (Trigger: Patient views personalized report & checks out treatment)

###       ▼

### \[Adherence Tracker\] 

###       │ (Trigger: Daily log entry on smartphone)

###       ▼

### \[Follow\-up Consultation\] 

###       │ (Trigger: Scheduled follow\-up photo validation)

| Journey Phase | Trigger | Data Created | User Touchpoint |
| :---- | :---- | :---- | :---- |
| **1\. Intake Registration** | Clinic arrival / QR scan | Patient demographic record | Front Desk QR kiosk |
| **2\. Photo Capture** | Photo suite session | Assessment\_images entries | Nurse interface with connected trichoscope |
| **3\. Draft Diagnosis** | Photo uploads finalize | Reports entry (Draft), raw Gemini outputs | AI engine execution background |
| **4\. Validation & Order** | Doctor review completed | Report\_reviews override file, generated prescription Orders | Doctor dashboard check |
| **5\. Avatar Video Rendering** | Script approval button click | Videos record update (Generating   Ready) | Edge engine, webhook listener |
| **6\. Patient Portal Intake** | SMS with report link sent | Audit\_logs ('REPORT\_READ\_BY\_PATIENT') | Mobile browser portal screen |
| **7\. Treatment Adherence** | 24-hour routine log prompt | Treatment check-in state tracking | Mobile push interface, daily tracking |
| **8\. Follow-up Comparison** | 90-day progress booking | New comparison Assessment entry | In-clinic progress comparison view |

### ---

## **9\. Clinic Journey**

### **Daily Operations Flow**

### codeCode

### 08:00 AM ── \[System Sync\]       \--\> Checks global appointments, marks low stock alerts

###  09:00 AM ── \[Patient Check\-in\]  \--\> Front desk issues QR cards; patients enter photography

###  10:00 AM ── \[AI Diagnostic\]     \--\> Edge workers feed Gemini; doctors review drafts in real-time

###  01:00 PM ── \[Dispensing Queue\]  \--\> Admin compounding check, seals and packages topical serums

###  03:00 PM ── \[HeyGen Pipelines\]  \--\> Script revisions signed off; video render completions hit webhooks

###  05:00 PM ── \[Performance Stats\] \--\> System locks daily audit logs, reports clinics' active KPIs

### **Key Operational Systems:**

* ### **Doctor Assignment:** Rotational allocation or manually routed to specialized dermatologists. Ensures no assessment remains unassigned for 

* ###  hours.

* ### **Treatment Dispensing:** Integrated compounding labels generated instantly on report approval. Interlocks with physical inventory to prevent prescribing out-of-stock bases.

### ---

## **10\. Validation Engine**

### The HairOS Validation Engine tracks AI diagnostic efficacy by contrasting raw Gemini outputs against final Doctor adjustments.

### **Agreement Score Formula**

### The system measures the congruence of AI and human physicians. For any assessment, the Agreement Score (

### ) is defined as:

### Where:

* ###  is the numerical categorization value assigned by the AI model (e.g., Norwood Scale 1–7, miniaturization percentage).

* ###  is the scale corrected by the Doctor.

* ###  represents the validated criteria (Norwood classification, Vertex loss severity, micro-miniaturization, scalp health indicator, recommended active ingredients).

### **Override Log Structure**

### When a physician updates any field on a draft report, the frontend presents a required justification dialogue.

### codeJSON

### {

###   "report\_id": "7f09320b-22fa-4cb5-b44e-a10c2ef36ee7",

###   "reviewer\_id": "92f392db-a55e-4091-a128-444bb22ef142",

###   "override\_event": {

###     "field": "norwood\_scale",

###     "ai\_value": "Norwood III Vertex",

###     "doctor\_value": "Norwood IV",

###     "doctor\_justification": "Temporal recession exceeds AI detection boundaries; micro images confirm early thinning on mid-scalp"

###   }

### }

### **Metrics Dashboard:**

1. ### **Mean Agreement Score:** Visualized across weeks to detect model drift.

2. ### **Override Hotspots:** Identifies specific parameters (e.g., skin irritation) that the AI consistently misdiagnoses. Used for downstream model fine-tuning or system prompt engineering.

### ---

## **11\. Audit & Compliance**

### To meet healthcare platform requirements, all tables operate under a strict audit design. No records containing clinical patient data are physically deleted from PostgreSQL.

### **Compliance Architecture Principles:**

* ### **Soft Delete Pattern:** Soft delete is handled by a global column filter (is\_deleted default: false). Soft-deleted records are excluded from standard API lookups.

* ### **Immutability of Log System:** The audit\_logs table has RLS policy settings preventing UPDATE or DELETE queries from any user role, including Super Admins.

* ### **Traceability Event Tracking:** Every diagnosis modification preserves a delta version log record.

| Event | Log Required | Reason |
| :---- | :---- | :---- |
| **ASSESSMENT\_SUBMITTED** | Yes | Timestamps initial patient diagnostic record entry |
| **AI\_ANALYSIS\_FAILED** | Yes | Alerts engineers of Gemini system outages or token limit issues |
| **PHYSICIAN\_OVERRIDE** | Yes | Required for medical liability and diagnostic traceability |
| **REPORT\_DISPATCHED** | Yes | Tracks when clinical data is legally shared with patient |
| **STOCK\_UPDATE\_MANUAL** | Yes | Ensures control over inventory drift or internal product leakage |
| **PATIENT\_DATA\_SOFT\_DELETE** | Yes | Maintains compliance records for active health audits |

### ---

## **12\. Treatment Management**

### HairOS bypasses generic e-commerce layouts in favor of clinical prescription regimens.

### codeCode

### \[Doctor Prescribes Regimen\]

###                     │

###                     ▼

###        \[Automated Order Compilation\]

###                     │

###                     ▼

###      \[Physical Inventory Checks & Deduction\]

###          ├── (In Stock)      ──\> \[Local Dispense & Seal\]

###          └── (Low / Out)     ──\> \[Auto Compounder Transfer File\]

### **Regimen Definitions:**

* ### **Compound formulation:** Personalized Minoxidil \+ Finasteride formulations adjusted dynamically by target dosage.

* ### **Fulfillment Pipeline:**

  * ### Real-time checks verify clinic stocks. If local stock is present, prescription is packed locally.

  * ### If below safety stock limits, the order routes instantly via secure PDF file transfer protocol to the partner compounding facility.

* ### 

### ---

## **13\. Notification Architecture**

### To guarantee high engagement, HairOS maintains an automated notification dispatcher.

### codeCode

### \[System Event\] ──\> \[Notification Dispatcher Router\]

###                             ├── (High Priority / High Value) ──\> \[WhatsApp API\]

###                             ├── (Transactional Code)         ──\> \[Twilio SMS\]

###                             └── (Weekly Adherence Status)    ──\> \[SendGrid Email\]

### **Retry and Fallback Logic:**

* ### If a transactional WhatsApp delivery fails (no read or deliver receipt received within 15 minutes), the dispatcher falls back to SMS.

* ### Critical transactional emails (e.g., prescription approvals) include full DKIM signatures and fallback PDF attachments generated at render time.

### **Templates Library:**

* ### PATIENT\_WELCOME\_QR: Emits QR code image attachment \+ verification code.

* ### REPORT\_READY\_VIDEO: Contains personalized call to action link pointing to portal page.

### ---

## **14\. Video Generation Pipeline**

### Personalized educational materials are synthesized on-demand to maximize conversion.

### codeCode

### \[Report Approved\] ──\> \[Gemini Script Compiler\] ──\> \[Doctor Review Script\] 

###                                                              │

###                                                              ▼

###   \[Patient Portal\] \<── \[Supabase Storage Upload\] \<── \[HeyGen Webhook Worker\]

### **Pipeline Workflow:**

1. ### **Compilation:** Gemini API takes approved diagnosis parameters and builds a clinical explanation script matching the doctor's persona.

2. ### **Verification:** The doctor views the compiled script on their review screen. They can perform manual adjustments or click "Approve and Render."

3. ### **Synthesis:** System issues API POST call to HeyGen, supplying heygen\_avatar\_id and script body text.

4. ### **Completion:** Webhook receiver catches video.completed event, pulls download URL, stores file inside secure Supabase storage bucket, and flags status as READY.

5. ### **Fallback:** If HeyGen crashes, the system defaults to generating an interactive diagnostic PDF containing rich data visualizations.

### ---

## **15\. API Contract**

### All backend routes require authentication tokens and enforce multi-tenant separation.

### codeCode

### Client request ──\> \[Edge Gateway JWT Verification\] ──\> \[RLS Verification Engine\] ──\> Service Resolver

### **Endpoints Inventory**

#### **1\. Authentication (/api/auth/session)**

* ### **Purpose:** Resolves active clinic member identity, permissions, and available multi-tenant clinic memberships.

* ### **Authentication:** JWT Bearer.

* ### **Input:** Auth header.

* ### **Output:** User identity record, clinic profile lists, active role claim.

#### **2\. Assessment Creation (/api/clinics/\[id\]/assessments)**

* ### **Purpose:** Creates new assessment workspace.

* ### **Authentication:** Active Member Session (Admin, Doctor, Staff).

* ### **Input:** patient\_id (UUID), intake\_responses (JSONB).

* ### **Output:** Created assessment\_id (UUID), image upload target configurations.

#### **3\. Image Upload Sign (/api/clinics/\[id\]/assessments/\[assessmentId\]/upload-urls)**

* ### **Purpose:** Issues secure, single-use signed upload paths directly to Supabase Storage.

* ### **Input:** views (Array of view strings).

* ### **Output:** Signed direct upload target URLs mapping storage buckets.

#### **4\. Run AI Diagnostics (/api/clinics/\[id\]/assessments/\[assessmentId\]/analyze)**

* ### **Purpose:** Triggers edge execution targeting Gemini Vision API.

* ### **Input:** Nil.

* ### **Output:** Raw analysis data, NORWOOD classification proposal, confidence metrics.

#### **5\. Save Report Review (/api/clinics/\[id\]/reports/\[id\]/review)**

* ### **Purpose:** Saves doctor adjustments and generates override delta files.

* ### **Input:** final\_diagnosis (JSONB), final\_treatment\_plan (JSONB), overrides (JSONB), justification\_text (TEXT).

* ### **Output:** Report review compliance entry.

#### **6\. Trigger Video Generation (/api/clinics/\[id\]/videos/generate)**

* ### **Purpose:** Dispatches render request to HeyGen API.

* ### **Input:** report\_id (UUID), script\_text (TEXT).

* ### **Output:** Rendering job ID, estimated complete duration.

### ---

## **16\. System Events**

### **Event Catalogue**

#### **1\. AssessmentCreated**

* ### **Producer:** Intake Edge Worker / Client App.

* ### **Consumers:** Notifications Dispatcher (notifies clinical team if high-risk status detected).

* ### **Payload:** { assessment\_id: "...", patient\_id: "...", timestamp: "..." }

#### **2\. ImagesUploaded**

* ### **Producer:** Client Storage Manager.

* ### **Consumers:** AI Processing Queue Worker.

* ### **Payload:** { assessment\_id: "...", view\_types: \["VERTEX", "CROWN"\], uploaded\_by: "..." }

#### **3\. AICompleted**

* ### **Producer:** Gemini Queue Engine.

* ### **Consumers:** Workspace Dashboard Dispatcher (pushes card to "Ready for Review" tab).

* ### **Payload:** { report\_id: "...", assessment\_id: "...", draft\_diagnosis: {...} }

#### **4\. ReportApproved**

* ### **Producer:** Doctor Action Service.

* ### **Consumers:** Video Pipeline Generator, Billing and Compounding Pharmacy Interface.

* ### **Payload:** { report\_id: "...", doctor\_id: "...", patient\_id: "..." }

#### **5\. VideoGenerated**

* ### **Producer:** HeyGen Webhook Dispatcher.

* ### **Consumers:** Client Notification Engine (fires SMS and WhatsApp Alerts).

* ### **Payload:** { video\_id: "...", report\_id: "...", storage\_url: "..." }

### ---

## **17\. Background Jobs**

### A set of system tasks run periodically to maintain the operation and safety of HairOS:

### codeCode

### 00:00 AM (Daily)  ──\> \[Cleanup Job\]       ──\> Purges incomplete assessments older than 30 days

###   Every 15 Minutes  ──\> \[Inventory Poller\]  ──\> Compares stock levels, fires alerts for SKUs under reorder point

###   Every 5 Minutes   ──\> \[Video Retry Job\]   ──\> Detects HeyGen render timeouts, triggers fallback pipelines

###   Every Hour        ──\> \[Appointment Sync\]  ──\> Auto\-flags "No-Show" consult status for expired slots

### ---

## **18\. Deployment Architecture**

### codeCode

### \[ Vercel CDN Edge Gateways \]

###                                                │

###                                  ┌─────────────┴─────────────┐

###                                  ▼                           ▼

###                        \[ Next.js Client App \]     \[ Next.js API Services \]

###                                  │                           │

###                                  ▼                           ▼

###                        \[ Supabase Storage \]       \[ Supabase PG & RLS \]

###                                  ▲                           ▲

###                                  │                           │

###                    \[ Realtime Channel Pushes \]    \[ Gemini & HeyGen API \]

### **Critical Environment Variables Configuration:**

### codeEnv

### \# .env.example

### DATABASE\_URL=

### DIRECT\_URL=

### NEXT\_PUBLIC\_SUPABASE\_URL=

### NEXT\_PUBLIC\_SUPABASE\_ANON\_KEY=

### SUPABASE\_SERVICE\_ROLE\_KEY=

### GEMINI\_API\_KEY=

### HEYGEN\_API\_KEY=

### HEYGEN\_WEBHOOK\_SECRET=

### TWILIO\_AUTH\_TOKEN=

### WHATSAPP\_BUSINESS\_API\_KEY=

### ---

## **19\. Implementation Roadmap**

### **Phase 1: Core Foundation & Multi-Tenancy (Weeks 1-2)**

* ### **Backend:** Setup database tables, define indexes, deploy Supabase Schema migrations, establish hard RLS separation constraints.

* ### **Frontend:** Build authentication, multi-clinic routing interfaces, and Organization Manager portals.

* ### **Acceptance Criteria:** A single user can log in and view, edit, and interact with data solely inside their assigned clinical tenant.

### **Phase 2: Patient Intake & Photo Suite (Weeks 3-4)**

* ### **Backend:** Configure Supabase Storage buckets, secure storage path access policies, implement intake API router.

* ### **Frontend:** Construct walk-in QR interface, mobile photo upload interface with integrated confidence score check indicator.

* ### **Acceptance Criteria:** Staff can upload multiple hi-res micro-images; confidence check passes files to database queue.

### **Phase 3: AI Engine & Doctor Workspace (Weeks 5-6)**

* ### **Backend:** Connect Gemini API integration, construct AI draft processor, implement Override Delta tracking engine.

* ### **Frontend:** Build Doctor Dashboard, side-by-side override interface, prescription compound catalog UI.

* ### **Acceptance Criteria:** Doctor can adjust AI recommendations, save overrides, and compile treatment catalog orders.

### **Phase 4: Video Synthesis & Delivery (Weeks 7-8)**

* ### **Backend:** Integrate HeyGen Video REST calls, configure webhook workers, connect WhatsApp API.

* ### **Frontend:** Establish Patient Portal, regimen adherence logs, video player screens.

* ### **Acceptance Criteria:** HeyGen webhook returns render outputs, saving files to storage; patient gets SMS notification pointing to active video portal.

### ---

## **20\. Final Folder Structure**

### The following Next.js App Router structure enforces modularity, clean boundaries, and a scalable codebase:

### codeCode

### src/

### ├── app/

### │   ├── (auth)/

### │   │   ├── login/

### │   │   └── signup/

### │   ├── (super-admin)/

### │   │   └── admin/

### │   ├── (dashboard)/

### │   │   ├── clinic-admin/

### │   │   └── doctor/

### │   ├── (portal)/

### │   │   └── patient/

### │   │       ├── diagnostic/

### │   │       └── progress/

### │   ├── api/

### │   │   ├── auth/

### │   │   ├── clinics/

### │   │   │   └── \[id\]/

### │   │   │       ├── assessments/

### │   │   │       │   └── \[assessmentId\]/

### │   │   │       │       └── analyze/

### │   │   │       ├── reports/

### │   │   │       ├── inventory/

### │   │   │       └── webhooks/

### │   │   │           └── heygen/

### │   │   └── layout.tsx

### │   └── page.tsx

### ├── components/

### │   ├── ui/

### │   ├── doctor/

### │   │   ├── OverridePanel.tsx

### │   │   └── QueueTable.tsx

### │   ├── patient/

### │   │   └── AdherenceTimeline.tsx

### │   └── shared/

### │       ├── CameraCapture.tsx

### │       └── QRScanner.tsx

### ├── lib/

### │   ├── ai/

### │   │   ├── gemini.ts

### │   │   └── heygen.ts

### │   ├── db/

### │   │   ├── prisma.ts

### │   │   └── schema.prisma

### │   └── notifications/

### │       └── dispatcher.ts

### └── types/

###     └── index.ts

### ---

## **21\. Summary of Completed Operations**

### I have conducted a thorough review of the current application design and produced the **HairOS (Dr FACT) Engineering Specification**.

### **Highlights of the Blueprint:**

* ### **Tenant Isolation:** Enforced separating Identity (users) from Membership (clinic\_members), layered over secure Supabase RLS.

* ### **Continuous Operations Queue:** Engineered a reactive, multi-stage column queue driving clinical, diagnostics, rendering, and delivery pipelines.

* ### **Doctor-in-the-Loop Validation:** Detailed an Override engine capturing Agreement Scores (

* ### ) to continually improve Gemini diagnostic suggestions.

* ### **Immersive Diagnostics:** Formulated a localized HeyGen Avatar script synthesis flow with automated webhook monitoring and static PDF fallback.

### This document serves as the absolute technical source of truth for the senior engineering team. No code blocks are added directly, keeping the codebase clean while ensuring strict architecture alignment.

### 