# Rangverse — Setup Guide (Beginners ke liye)

Ye guide maan ke chalti hai ki aapne pehle kabhi koi web app deploy nahi ki.
Har step detail me hai. Jaldi mat karo, ek-ek karke karo.

**Total time:** pehli baar me 1–1.5 ghanta
**Kharcha:** ₹0 (sab free tier me)

---

## Pehle samajh lo kya kar rahe hain

Rangverse ke 3 hisse hain:

| Hissa | Kya karta hai | Kahan rahega |
|---|---|---|
| **Code** (ye project) | Website ka design aur logic | GitHub pe |
| **Database** | Interns, attendance, tasks ka data | Supabase pe |
| **Hosting** | Website ko internet pe chalana | Vercel pe |

Teeno ko aapas me jodna hai. Isliye steps itne hain.

---

# PART 1 — Laptop taiyaar karo

## Step 1.1 — Node.js install karo

Node.js ke bina project chalega hi nahi.

1. Browser me kholo: **https://nodejs.org**
2. Do green buttons dikhenge — **LTS** wala button dabao (left wala)
   - LTS = "Long Term Support" = stable version
   - Dusra wala "Current" hota hai, wo mat lena
3. `.msi` file download hogi → double click
4. Installer me bas **Next → Next → Install** dabate jao, kuch change mat karo
5. Install hone ke baad **laptop restart kar do** (zaroori hai, warna PATH update nahi hoga)

### Verify karo ki sahi laga

**Command Prompt kholo:**
- Keyboard pe `Windows` key dabao
- `cmd` type karo
- Enter dabao

Ab ye type karke Enter dabao:

```
node --version
```

Aisa kuch dikhna chahiye: `v20.11.0` ya `v22.x.x` ya `v24.x.x`

Phir ye:

```
npm --version
```

Aisa kuch: `10.2.4`

**Agar "not recognized" aaye** → restart nahi kiya hoga, ya install fail hua. Dobara install karo.

---

## Step 1.2 — Git install karo

Git code ko GitHub pe bhejne ke liye chahiye.

1. Kholo: **https://git-scm.com/download/win**
2. Download apne aap shuru ho jayega
3. Installer chalao — **saare screens pe bas Next dabao**, default settings bilkul theek hain
   (bahut saare screens aayenge, ghabrao mat, sabme Next)

### Verify karo

Naya Command Prompt kholo (purana band karke) aur type karo:

```
git --version
```

Aisa kuch: `git version 2.43.0`

---

## Step 1.3 — Code Editor install karo (optional but recommended)

File edit karne ke liye Notepad se kaam chal jayega, lekin VS Code bahut easy hai.

1. Kholo: **https://code.visualstudio.com**
2. Download → install → Next Next Next

---

# PART 2 — Project ko laptop pe laao

## Step 2.1 — Zip extract karo

1. WhatsApp se `Rangverse-project.zip` download karo
2. File pe **right-click → Extract All...**
3. Location choose karo — simple rakho, jaise:
   ```
   C:\Projects
   ```
   (agar `C:\Projects` folder nahi hai to bana lo)
4. **Extract** dabao

Ab aapka project yahan hoga: `C:\Projects\Rangverse`

> **Note:** Folder ka naam `Rangverse` hi rakhna. Andar jaake check karo ki
> `package.json` file dikh rahi hai. Agar `Rangverse` ke andar ek aur `Rangverse`
> folder hai, to andar wale ko bahar nikaal lo.

### 🔴 Project OneDrive / Desktop me MAT rakhna

Agar project OneDrive ke andar (ya sync hone wale Desktop/Documents me) rakha,
to build karte waqt ye error aayega:

```
EPERM: operation not permitted, unlink '.next\static\...'
```

Hota kyun hai: OneDrive background me files sync karta rehta hai aur build
folder ko lock kar leta hai. Next.js us file ko replace nahi kar pata.

**Isliye `C:\Projects` jaisi simple jagah use karo** — jo sync na hoti ho.

Agar phir bhi ye error aa jaye: `.next` folder delete karke dobara build karo.

## Step 2.2 — Us folder me terminal kholo

Ye bahut kaam aayega, isliye dhyan se:

**Tarika 1 (easy):**
1. File Explorer me `C:\Projects\Rangverse` folder kholo
2. Upar address bar me click karo (jahan path likha hai)
3. Pura path select ho jayega — ab `cmd` type karke Enter dabao
4. Terminal khul jayega, already us folder me

**Tarika 2 (VS Code se):**
1. VS Code kholo → File → Open Folder → `C:\Projects\Rangverse`
2. Upar menu me **Terminal → New Terminal**

> **Important:** Aage ke saare commands isi terminal me chalenge, jo
> `C:\Projects\Rangverse` folder me khula ho. Confirm karne ke liye terminal me
> `dir` type karo — `package.json` dikhna chahiye.

## Step 2.3 — Dependencies install karo

Terminal me:

```
npm install
```

- 3–5 minute lagega
- Bahut saara text scroll hoga — normal hai
- Beech me `npm warn` aaye to ignore karo, wo warning hai error nahi
- Khatam hone pe aisa kuch: `added 492 packages`

> **Agar PowerShell me error aaye** jaise *"running scripts is disabled"* —
> to PowerShell ki jagah **Command Prompt (cmd)** use karo. Ya phir har command
> ke aage ye laga do:
> ```
> cmd /c "npm install"
> ```

---

# PART 3 — GitHub pe code daalo

## Step 3.1 — GitHub account banao

1. Kholo: **https://github.com**
2. **Sign up** → apni **personal email** daalo (office email nahi)
3. Username choose karo, password set karo
4. Email verify karo (inbox check karo)

## Step 3.2 — Naya repository banao

1. GitHub pe login karke, upar-right me **+** icon dabao → **New repository**
2. Form bharo:

   | Field | Kya daalein |
   |---|---|
   | Repository name | `rangverse` |
   | Description | `Rangmanch internal workspace` (optional) |
   | Public / Private | **🔴 PRIVATE select karo** |
   | Add a README file | ☐ **tick mat karo** |
   | Add .gitignore | **None** rakho |
   | Choose a license | **None** rakho |

3. **Create repository** dabao

> ### ⚠️ PRIVATE kyun zaroori hai
> Is app me interns ka personal data (phone, college) aur Rangmanch ke brand
> contacts honge. Public repo matlab duniya ka koi bhi dekh sakta hai.
> **Hamesha Private.**

> ### ⚠️ README tick kyun nahi karna
> Project me pehle se README hai. Agar GitHub bhi ek bana dega to push karte
> waqt conflict aayega.

4. Agla page khulega jisme commands likhe honge. Us page ko **khula chhod do**,
   URL chahiye hoga. URL aisa dikhega:
   ```
   https://github.com/<aapka-username>/rangverse.git
   ```

## Step 3.3 — Apna naam commit pe lagao

Abhi commit ek placeholder naam se hai. Apna naam lagane ke liye terminal me:

```
git config user.name "Prakhar Varshney"
```

```
git config user.email "aapka-personal@email.com"
```

> Email **wahi daalo jo GitHub account pe hai**, warna GitHub aapko credit nahi dega.

Phir:

```
git commit --amend --reset-author --no-edit
```

Ek editor khul sakta hai — agar khule to bas band kar do (`Esc` phir `:q` phir Enter,
agar Vim ho). Ya `--no-edit` ki wajah se shayad khulega hi nahi.

## Step 3.4 — Personal Access Token banao

GitHub ab password se push nahi karne deta. Token chahiye.

1. GitHub pe: upar-right apni photo pe click → **Settings**
2. Left menu me **sabse neeche** scroll karo → **Developer settings**
3. **Personal access tokens** → **Tokens (classic)**
4. **Generate new token** → **Generate new token (classic)**
5. Bharo:

   | Field | Kya daalein |
   |---|---|
   | Note | `rangverse-laptop` |
   | Expiration | `90 days` (ya jo theek lage) |
   | Scopes | **`repo` wala checkbox tick karo** (upar wala, sab sub-items apne aap tick ho jayenge) |

6. Neeche **Generate token** dabao
7. Ek lamba code dikhega jaise `ghp_xxxxxxxxxxxxxxxxxxxx`

> ### 🔴 ABHI COPY KARKE SAVE KARO
> Ye token **sirf ek baar dikhta hai**. Page refresh kiya to gaya.
> Notepad me paste karke rakh lo filhaal.
> Ye password jaisa hai — kisi ko mat dena, kahin paste mat karna.

## Step 3.5 — Code push karo

Terminal me (apne username se replace karna):

```
git remote add origin https://github.com/<aapka-username>/rangverse.git
```

```
git branch -M main
```

```
git push -u origin main
```

Ab pucheda jayega:
- **Username:** aapka GitHub username
- **Password:** 🔴 **yahan password NAHI, wo TOKEN paste karo** (`ghp_...` wala)

> Token paste karte waqt screen pe kuch nahi dikhega — ye normal hai,
> security ke liye hota hai. Bas paste karke Enter daba do.

Push hone ke baad GitHub pe page refresh karo — saari files dikhengi. ✅

---

# PART 4 — Database banao (Supabase)

## Step 4.1 — Account aur project

1. Kholo: **https://supabase.com** → **Start your project**
2. **Continue with GitHub** (jo abhi banaya usse login kar lo — easy)
3. **New project** dabao
4. Form bharo:

   | Field | Kya daalein |
   |---|---|
   | Name | `rangverse` |
   | Database Password | Strong password generate karo |
   | Region | **South Asia (Mumbai)** |
   | Plan | **Free** |

5. **Create new project**
6. ⏳ 2–3 minute lagega. Chai pi lo.

> ### 🔴 Database password save kar lo
> Notepad me likh lo. Abhi shayad zarurat na pade, lekin kabhi backup ya direct
> database access ke liye chahiye hoga, aur ye dobara nahi dikhta.

> ### Region Mumbai kyun
> Jitna paas server, utni fast website. Team India me hai to Mumbai best hai.

## Step 4.2 — Tables banao (6 files, order me)

Ye sabse important step hai. **Order galat hua to fail hoga.**

1. Supabase me left sidebar se **SQL Editor** kholo (`</>` icon)
2. **New query** dabao

Ab ye 6 files **ek-ek karke, isi order me** chalani hain:

```
1.  supabase/migrations/0001_core.sql
2.  supabase/migrations/0002_attendance.sql
3.  supabase/migrations/0003_tasks.sql
4.  supabase/migrations/0004_daily_reports.sql
5.  supabase/migrations/0005_data_hub.sql
6.  supabase/migrations/0006_time_state_machine.sql
```

**Har file ke liye ye karo:**

1. Apne laptop pe `C:\Projects\Rangverse\supabase\migrations\` folder kholo
2. File ko **Notepad ya VS Code** me kholo
3. `Ctrl + A` (sab select) → `Ctrl + C` (copy)
4. Supabase SQL Editor me `Ctrl + V` (paste)
5. Neeche-right **Run** dabao (ya `Ctrl + Enter`)
6. **"Success. No rows returned"** aana chahiye ✅
7. Editor khali karo (`Ctrl + A` → `Delete`) aur agli file ke liye repeat

> ### ⚠️ Order kyun zaroori hai
> File 2 file 1 ki tables use karti hai, file 3 file 2 ki, aise hi aage.
> Beech se shuru kiya to *"relation does not exist"* error aayega.

> ### Agar error aa jaye
> - Error padho — `relation "xyz" does not exist` matlab pichli file chali hi nahi
> - **Theek karne ka easy tarika:** Settings → General → neeche **Reset database**
>   (sab mitt jayega) → phir 0001 se shuru karo
> - Ya naya project bana lo, free me unlimited hai

### Optional: starter sheets

`supabase/seed.sql` bhi isi tarike se chala sakte ho. Ye 2 teams aur 4 khaali
Data Hub sheets bana deta hai (Influencer Directory, Brand Leads, etc.).

Isme koi fake intern ya fake data nahi hai — bas khaali structure.

## Step 4.3 — Login settings theek karo

1. Left sidebar → **Authentication** → **Sign In / Providers**
2. **Email** provider **ON** hona chahiye (default on hota hai)
3. Neeche scroll karke dhoondho: **"Allow new users to sign up"**
4. 🔴 **Ise OFF karo**
5. **Save** dabao

> ### ⚠️ Ye kyun OFF karna hai
> Rangverse **invite-only** hai — sirf admin hi logo ko add kar sakta hai.
> Agar ye ON chhoda, to internet pe koi bhi khud ka account banakar andar
> aa jayega. Ye sabse badi security galti hogi.

## Step 4.4 — 3 keys copy karo

1. Left sidebar me sabse neeche **Project Settings** (⚙️ gear icon)
2. **API** pe click karo
3. Teen cheezein copy karni hain — **Notepad me saaf-saaf likh lo:**

   | Supabase me naam | Kaisa dikhta hai | Secret? |
   |---|---|---|
   | **Project URL** | `https://abcdxyz.supabase.co` | Nahi |
   | **anon** / **publishable** key | `eyJhbGc...` (bahut lamba) | Nahi |
   | **service_role** key | `eyJhbGc...` (bahut lamba) | 🔴 **HAAN** |

> ### ⚠️ Confusion yahan hoti hai
> `anon` aur `service_role` **dono** `eyJhbGc...` se shuru hote hain aur dono
> lambe hain. **Galat jagah daal diya to app toot jayegi ya unsafe ho jayegi.**
>
> Notepad me aise likho taaki confusion na ho:
> ```
> URL     = https://abcdxyz.supabase.co
> ANON    = eyJhbGc...(pehla wala)
> SERVICE = eyJhbGc...(dusra wala, chhupa hua tha)
> ```
> `service_role` key chhupi hoti hai — "Reveal" ya 👁️ dabana padta hai.

> ### 🔴 service_role key kabhi kisi ko mat do
> Ye key saari security bypass kar deti hai. Isse koi bhi pura database
> padh/mita sakta hai. Sirf Vercel ke secret box me jayegi.

---

# PART 5 — Pehle LOCAL pe chalao (deploy se pehle)

> **Ye step skip mat karna.** Pehle laptop pe chala ke dekh lo. Agar yahan
> chal gaya to deploy bhi chalega. Seedha deploy karke problem dhoondhna
> bahut mushkil hota hai.

## Step 5.1 — `.env.local` file banao

Ye file database ki keys rakhti hai.

### VS Code se (recommended — safe tarika)

1. VS Code me `C:\Projects\Rangverse` folder khula ho
2. Left file list me **right-click** (khali jagah pe) → **New File**
3. Naam do: `.env.local`  ← **shuru me dot zaroori hai**
4. Andar ye paste karo aur apni values bharo:

```
NEXT_PUBLIC_SUPABASE_URL=https://abcdxyz.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=eyJhbGc...anon-key-yahan
NEXT_PUBLIC_SITE_URL=http://localhost:3000
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...service-role-key-yahan
```

5. `Ctrl + S` se save karo

### ⚠️ Notepad use kar rahe ho to ye trap hai

Notepad file ko `.env.local.txt` bana deta hai — **tab app kaam nahi karegi**.
Bachne ke liye: Save karte waqt **"Save as type"** ko **"All Files (*.*)"**
karo, aur filename me quotes lagao: `".env.local"`

### Check karo file sahi hai

Terminal me:

```
dir .env*
```

`.env.local` dikhna chahiye. Agar `.env.local.txt` dikhe to rename kar do.

> ### Format ke rules
> - `=` ke aas-paas **space mat do** → `KEY=value` ✅ , `KEY = value` ❌
> - Value ke aas-paas **quotes mat lagao** → `KEY=abc` ✅ , `KEY="abc"` ❌
> - Har line alag honi chahiye

> ### Ye file GitHub pe nahi jayegi
> `.gitignore` me already set hai. Keys safe rahengi. ✅

## Step 5.2 — Pehla admin banao

Terminal me:

```
npm run db:bootstrap-admin
```

Teen cheezein puchega:

1. **Administrator email:** apni email daalo (yahi se login karoge)
2. **Full name:** apna naam
3. **Password:** strong password — kam se kam **12 characters**, isme
   **capital letter + small letter + number** hona chahiye

   🔴 **Password type karte waqt screen pe KUCH NAHI dikhega** — na dots, na
   stars, kuch bhi nahi. **Ye normal hai**, security feature hai.
   Keyboard kharab nahi hai. Bas type karke Enter daba do.

4. Password dobara confirm karo

Success pe: `✓ Administrator created for aapki@email.com`

> ### 🔴 Ye password save kar lo
> Dobara nahi dikhega. Bhool gaye to app ke "Forgot password" se reset karna
> padega (uske liye email setup chahiye hoga).

> **Agar error aaye** *"An administrator already exists"* — matlab pehle hi
> bana liya tha. Theek hai, aage badho.

## Step 5.3 — App chalao

```
npm run dev
```

Dikhega:
```
▲ Next.js 16.4.0
- Local: http://localhost:3000
✓ Ready
```

Browser me kholo: **http://localhost:3000**

Dikhna chahiye: kaala background, gold "Sign in" button, Rangverse logo.

Apni admin email + password se **login karke dekho**.

### Kuch na chale to — message dhyan se padho

App teen **alag-alag** message deta hai, taaki aapko asli problem pata chale:

| Screen pe dikhe | Asli problem | Fix |
|---|---|---|
| *"Rangverse is not connected yet"* | `.env.local` mili hi nahi, ya `.env.local.txt` ban gayi | Step 5.1 dobara |
| *"Cannot reach the Rangverse database right now"* | File to mil gayi, lekin Supabase tak pahunch nahi raha — URL galat, ya internet | URL check karo (`https://` se shuru, `.supabase.co` pe khatam) |
| *"That email and password combination did not work"* | Server theek hai, **credentials galat hain** | Step 5.2 dobara, ya password galat yaad hai |

> Ye farq isliye rakha hai taaki aap ghante password reset na karte raho jab
> asli problem URL me ho.

### Baaki problems

| Problem | Kya karein |
|---|---|
| Page khulta hi nahi | Terminal check karo, `npm run dev` chal raha hai? |
| Port 3000 busy | Koi aur app chal rahi hai, band karo |
| `EPERM ... .next` | Project OneDrive me hai — `C:\Projects` me shift karo |

**Terminal band karne ke liye:** `Ctrl + C` dabao

---

# PART 6 — Internet pe live karo (Vercel)

## Step 6.1 — Vercel pe import karo

1. Kholo: **https://vercel.com**
2. **Continue with GitHub** (wahi account)
3. **Add New...** → **Project**
4. List me `rangverse` dhoondho → **Import**

## Step 6.2 — Environment variables daalo

Deploy dabane se **pehle**, **Environment Variables** section kholo.

Chaar variables add karne hain — ek-ek karke:

| Name | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | aapka Supabase URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | anon key |
| `NEXT_PUBLIC_SITE_URL` | `https://rangverse.vercel.app` *(abhi andaza, baad me theek karenge)* |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role key — **"Sensitive" tick karo** 🔴 |

> Bilkul wahi values jo `.env.local` me hain. Copy-paste karo, type mat karo —
> ek character galat hua to kaam nahi karega.

## Step 6.3 — Deploy

**Deploy** dabao → 2–4 minute.

Confetti 🎉 dikhe to ho gaya. Aapko URL milega jaise:
```
https://rangverse-abc123.vercel.app
```

**Ye URL copy kar lo.**

## Step 6.4 — 🔴 Do cheezein FIX karo (skip mat karna)

Abhi website khulegi lekin **invite emails aur password reset TUT JAYENGE**.
Kyunki app ko abhi tak apna asli address nahi pata.

### Fix 1 — Vercel me URL theek karo

1. Vercel → aapka project → **Settings** → **Environment Variables**
2. `NEXT_PUBLIC_SITE_URL` dhoondho → **Edit**
3. Value badal ke asli URL daalo: `https://rangverse-abc123.vercel.app`
4. **Save**
5. Upar **Deployments** tab → sabse upar wale pe `...` → **Redeploy**

> Redeploy zaroori hai, warna purani value hi chalti rahegi.

### Fix 2 — Supabase ko URL batao

1. Supabase → **Authentication** → **URL Configuration**
2. **Site URL** = `https://rangverse-abc123.vercel.app`
3. **Redirect URLs** me **Add URL** dabao aur daalo:
   ```
   https://rangverse-abc123.vercel.app/auth/callback
   ```
4. **Save**

> ### Ye kyun zaroori hai
> Jab kisi intern ko invite karoge, usko email jayegi. Us email ke link ko
> Supabase tabhi allow karega jab wo URL yahan listed ho. Nahi to
> *"redirect not allowed"* error aayega aur koi join hi nahi kar payega.

## Step 6.5 — Test karo

1. Apna Vercel URL kholo
2. Admin email + password se login karo
3. Left menu me **People** jao
4. **Invite someone** dabao → apni dusri email daalo → test karo ki email aati hai

Sab chal gaya? **Live ho gaya!** 🎉

---

# Daily use — ab kya karna hai

## Naye intern ko add karna

1. Login → **People** → **Invite someone**
2. Naam, email, role (**Intern**), manager, team, joining date bharo
3. **Send invitation** — unko email jayegi
4. Wo link se password set karenge aur andar aa jayenge

> Intern khud ka role ya manager nahi badal sakta — database level pe block hai.

## Data Hub sheets

1. **Data hub admin** → sheet banao (template choose kar sakte ho)
2. Har sheet pe decide karo kaun dekh sakta hai (View ya Edit)
3. Records assign karo — intern ko **sirf uske assigned records** dikhenge

## Code me badlav karna

```
git add -A
git commit -m "kya badla uska short description"
git push
```

Vercel **apne aap** naya version deploy kar dega. Kuch aur nahi karna.

---

# Jab kuch toote

| Dikh raha hai | Matlab | Fix |
|---|---|---|
| "Rangverse is not connected yet" | Env vars missing/galat | Vercel me chaaro check karo, phir Redeploy |
| "Cannot reach the Rangverse database" | URL galat ya Supabase down | URL verify karo |
| "Email and password did not work" | Credentials galat (server theek hai) | Password check karo |
| Login ke baad khali | Admin nahi bana | `npm run db:bootstrap-admin` |
| Invite email ka link galat jagah | `NEXT_PUBLIC_SITE_URL` galat | Step 6.4 dono fix |
| SQL me "relation does not exist" | Migration order galat | 0001 se dobara |
| "Permission denied" app me | Sahi hai! Security kaam kar rahi hai | Role/access check karo |
| `EPERM ... .next` | Project OneDrive me hai | `C:\Projects` me shift karo |
| `npm install` fail | Node purana | `node --version` — 20+ chahiye |
| PowerShell "scripts disabled" | Windows policy | `cmd` use karo |

---

# Kharcha

| Service | Free me | Kab paisa lagega |
|---|---|---|
| Supabase | 500MB DB, 50k users | 50–100 interns tak aaram se free |
| Vercel | 100GB bandwidth | Internal tool ke liye kaafi |
| GitHub | Unlimited private repos | Kabhi nahi |

**Shuru me ₹0/month.**

> ⚠️ **Ek legal baat:** Vercel ka free (Hobby) plan technically commercial use
> ke liye nahi hai. Rangmanch ka internal company tool hai, to aage chal ke
> **Vercel Pro ($20/mo ≈ ₹1,700)** lena padega. Abhi testing/trial ke liye
> free bilkul theek hai.

---

# Security — 5 rules jo kabhi mat todna

1. **Repo hamesha Private** — intern data aur company contacts hain
2. **`service_role` key kabhi share mat karo** — chat me, screenshot me, code me, kahin nahi
3. **Supabase me signup OFF rakho** — warna koi bhi ghus jayega
4. **`.env.local` kabhi commit mat karo** — gitignore me hai, usse hatana mat
5. **GitHub token password jaisa hai** — leak ho jaye to GitHub pe jaake turant delete karo

---

# Aur padhne ke liye

| File | Kya hai |
|---|---|
| `README.md` | Project ka overview |
| `docs/deployment.md` | Deployment ka technical detail |
| `docs/security-model.md` | Kaun kya dekh sakta hai, kyun |
| `docs/testing.md` | Tests kaise chalayein |
| `docs/roadmap.md` | Version 2 aur 3 me kya aayega |

---

**Fas jao to:** error ka exact text copy karo aur poocho. Guess mat karo —
khaas kar database aur keys ke maamle me.
