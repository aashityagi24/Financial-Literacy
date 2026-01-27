"""School-related routes - Admin management and School dashboard"""
from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
import uuid
import hashlib

# Database injection
_db = None

def init_db(database):
    """Initialize database reference"""
    global _db
    _db = database

def get_db():
    """Get database instance"""
    if _db is None:
        raise RuntimeError("Database not initialized")
    return _db

router = APIRouter(tags=["school"])

# ============== ADMIN SCHOOL MANAGEMENT ==============

@router.post("/admin/schools")
async def admin_create_school(request: Request):
    """Create a new school (admin only)"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    
    data = await request.json()
    name = data.get("name")
    username = data.get("username")
    password = data.get("password")
    address = data.get("address")
    contact_email = data.get("contact_email")
    
    if not name or not username or not password:
        raise HTTPException(status_code=400, detail="Name, username, and password are required")
    
    existing = await db.schools.find_one({"username": username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")
    
    school_id = f"school_{uuid.uuid4().hex[:12]}"
    password_hash = hashlib.sha256(password.encode()).hexdigest()
    
    school_doc = {
        "school_id": school_id,
        "name": name,
        "username": username,
        "password_hash": password_hash,
        "address": address,
        "contact_email": contact_email,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.schools.insert_one(school_doc)
    
    return {
        "school_id": school_id,
        "message": f"School '{name}' created successfully"
    }

@router.get("/admin/schools")
async def admin_get_schools(request: Request):
    """Get all schools (admin only)"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    
    schools = await db.schools.find({}, {"_id": 0, "password_hash": 0}).to_list(100)
    
    for school in schools:
        school["teacher_count"] = await db.users.count_documents({
            "school_id": school["school_id"],
            "role": "teacher"
        })
        school["student_count"] = await db.users.count_documents({
            "school_id": school["school_id"],
            "role": "child"
        })
    
    return schools

@router.delete("/admin/schools/{school_id}")
async def admin_delete_school(school_id: str, request: Request):
    """Delete a school (admin only)"""
    from services.auth import require_admin
    db = get_db()
    await require_admin(request)
    
    school = await db.schools.find_one({"school_id": school_id})
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
    
    await db.users.update_many(
        {"school_id": school_id},
        {"$unset": {"school_id": ""}}
    )
    
    await db.schools.delete_one({"school_id": school_id})
    
    return {"message": f"School '{school['name']}' deleted"}

# ============== SCHOOL DASHBOARD ==============

@router.get("/school/dashboard")
async def get_school_dashboard(request: Request):
    """Get school dashboard overview"""
    from services.auth import require_school
    db = get_db()
    school = await require_school(request)
    school_id = school["school_id"]
    
    teachers = await db.users.find(
        {"school_id": school_id, "role": "teacher"},
        {"_id": 0, "password": 0}
    ).to_list(500)
    
    students = await db.users.find(
        {"school_id": school_id, "role": "child"},
        {"_id": 0, "password": 0}
    ).to_list(1000)
    
    teacher_ids = [t["user_id"] for t in teachers]
    classrooms = await db.classrooms.find(
        {"teacher_id": {"$in": teacher_ids}},
        {"_id": 0}
    ).to_list(500)
    
    for student in students:
        for classroom in classrooms:
            classroom_students = await db.classroom_students.find(
                {"classroom_id": classroom["classroom_id"]},
                {"_id": 0}
            ).to_list(100)
            if student["user_id"] in [s.get("student_id") for s in classroom_students]:
                student["teacher_name"] = next(
                    (t["name"] for t in teachers if t["user_id"] == classroom["teacher_id"]),
                    "Unknown"
                )
                student["classroom_name"] = classroom["name"]
                break
    
    return {
        "school": {
            "school_id": school["school_id"],
            "name": school["name"]
        },
        "stats": {
            "total_teachers": len(teachers),
            "total_students": len(students),
            "total_classrooms": len(classrooms)
        },
        "teachers": teachers,
        "students": students
    }

@router.get("/school/students/comparison")
async def get_school_students_comparison(request: Request):
    """Get comparison data for all students in the school"""
    from services.auth import require_school
    db = get_db()
    school = await require_school(request)
    school_id = school["school_id"]
    
    students = await db.users.find(
        {"school_id": school_id, "role": "child"},
        {"_id": 0}
    ).to_list(1000)
    
    if not students:
        return {"students": [], "count": 0}
    
    teachers = await db.users.find(
        {"school_id": school_id, "role": "teacher"},
        {"_id": 0, "user_id": 1, "name": 1}
    ).to_list(500)
    teacher_map = {t["user_id"]: t["name"] for t in teachers}
    
    classrooms = await db.classrooms.find(
        {"teacher_id": {"$in": list(teacher_map.keys())}},
        {"_id": 0}
    ).to_list(500)
    
    student_teacher_map = {}
    for classroom in classrooms:
        links = await db.classroom_students.find(
            {"classroom_id": classroom["classroom_id"]},
            {"_id": 0}
        ).to_list(100)
        for link in links:
            student_teacher_map[link["student_id"]] = {
                "teacher_name": teacher_map.get(classroom["teacher_id"], "Unknown"),
                "classroom_name": classroom["name"]
            }
    
    comparison_data = []
    
    for student in students:
        student_id = student["user_id"]
        
        wallets = await db.wallet_accounts.find(
            {"user_id": student_id},
            {"_id": 0}
        ).to_list(10)
        total_balance = sum(w.get("balance", 0) for w in wallets)
        
        lessons = await db.user_content_progress.count_documents({
            "user_id": student_id,
            "completed": True
        })
        
        quests = await db.quest_completions.count_documents({
            "user_id": student_id,
            "is_completed": True
        })
        
        teacher_info = student_teacher_map.get(
            student_id,
            {"teacher_name": "Unassigned", "classroom_name": "-"}
        )
        
        comparison_data.append({
            "student_id": student_id,
            "name": student.get("name", "Unknown"),
            "email": student.get("email"),
            "grade": student.get("grade"),
            "streak": student.get("streak_count", 0),
            "total_balance": round(total_balance, 2),
            "lessons_completed": lessons,
            "quests_completed": quests,
            "teacher_name": teacher_info["teacher_name"],
            "classroom_name": teacher_info["classroom_name"]
        })
    
    comparison_data.sort(key=lambda x: x["lessons_completed"], reverse=True)
    
    return {
        "students": comparison_data,
        "count": len(comparison_data)
    }

# ============== SCHOOL INDIVIDUAL USER CREATION ==============

@router.post("/school/users/teacher")
async def school_create_teacher(request: Request):
    """Create a single teacher for the school"""
    from services.auth import require_school
    db = get_db()
    school = await require_school(request)
    school_id = school["school_id"]
    
    body = await request.json()
    name = body.get("name", "").strip()
    email = body.get("email", "").strip().lower()
    
    if not name or not email:
        raise HTTPException(status_code=400, detail="Name and email are required")
    
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    
    user_doc = {
        "user_id": user_id,
        "email": email,
        "name": name,
        "role": "teacher",
        "school_id": school_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    
    # Fetch the clean user without _id
    created_user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"message": "Teacher created successfully", "user_id": user_id, "user": created_user}

@router.post("/school/users/parent")
async def school_create_parent(request: Request):
    """Create a single parent for the school"""
    from services.auth import require_school
    db = get_db()
    school = await require_school(request)
    school_id = school["school_id"]
    
    body = await request.json()
    name = body.get("name", "").strip()
    email = body.get("email", "").strip().lower()
    
    if not name or not email:
        raise HTTPException(status_code=400, detail="Name and email are required")
    
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    
    user_doc = {
        "user_id": user_id,
        "email": email,
        "name": name,
        "role": "parent",
        "school_id": school_id,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    
    # Fetch the clean user without _id
    created_user = await db.users.find_one({"user_id": user_id}, {"_id": 0})
    return {"message": "Parent created successfully", "user_id": user_id, "user": created_user}

@router.post("/school/users/child")
async def school_create_child(request: Request):
    """Create a single child/student for the school"""
    from services.auth import require_school
    db = get_db()
    school = await require_school(request)
    school_id = school["school_id"]
    
    body = await request.json()
    name = body.get("name", "").strip()
    email = body.get("email", "").strip().lower()
    grade = body.get("grade", 3)
    parent_email = body.get("parent_email", "").strip().lower()
    classroom_code = body.get("classroom_code", "").strip().upper()
    
    if not name or not email:
        raise HTTPException(status_code=400, detail="Name and email are required")
    
    existing = await db.users.find_one({"email": email})
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user_id = f"user_{uuid.uuid4().hex[:12]}"
    
    user_doc = {
        "user_id": user_id,
        "email": email,
        "name": name,
        "role": "child",
        "grade": grade,
        "school_id": school_id,
        "streak_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.users.insert_one(user_doc)
    
    # Create wallet accounts
    for account_type in ["spending", "savings", "gifting", "investing"]:
        await db.wallet_accounts.insert_one({
            "account_id": f"acc_{uuid.uuid4().hex[:12]}",
            "user_id": user_id,
            "account_type": account_type,
            "balance": 100 if account_type == "spending" else 0,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    # Link to parent if provided
    if parent_email:
        parent = await db.users.find_one({"email": parent_email, "role": "parent"})
        if parent:
            await db.parent_child_links.insert_one({
                "link_id": f"link_{uuid.uuid4().hex[:12]}",
                "parent_id": parent["user_id"],
                "child_id": user_id,
                "status": "active",
                "created_at": datetime.now(timezone.utc).isoformat()
            })
    
    # Join classroom if code provided
    if classroom_code:
        classroom = await db.classrooms.find_one({"join_code": classroom_code})
        if classroom:
            await db.classroom_students.insert_one({
                "enrollment_id": f"enroll_{uuid.uuid4().hex[:12]}",
                "classroom_id": classroom["classroom_id"],
                "student_id": user_id,
                "status": "active",
                "enrolled_at": datetime.now(timezone.utc).isoformat()
            })
    
    return {"message": "Child created successfully", "user_id": user_id, "user": user_doc}

@router.get("/school/users")
async def school_get_users(request: Request):
    """Get all users associated with the school"""
    from services.auth import require_school
    db = get_db()
    school = await require_school(request)
    school_id = school["school_id"]
    
    users = await db.users.find(
        {"school_id": school_id},
        {"_id": 0}
    ).sort("created_at", -1).to_list(1000)
    
    return {
        "users": users,
        "count": len(users),
        "by_role": {
            "teachers": sum(1 for u in users if u.get("role") == "teacher"),
            "parents": sum(1 for u in users if u.get("role") == "parent"),
            "children": sum(1 for u in users if u.get("role") == "child")
        }
    }

# ============== SCHOOL BULK UPLOAD ==============

@router.post("/school/upload/teachers")
async def school_upload_teachers(request: Request):
    """Bulk upload teachers via CSV data"""
    from services.auth import require_school
    db = get_db()
    school = await require_school(request)
    school_id = school["school_id"]
    
    body = await request.json()
    csv_data = body.get("data", [])
    
    created = 0
    errors = []
    
    for row in csv_data:
        name = row.get("name", "").strip()
        email = row.get("email", "").strip().lower()
        
        if not name or not email:
            errors.append(f"Missing name or email: {row}")
            continue
        
        existing = await db.users.find_one({"email": email})
        if existing:
            if not existing.get("school_id"):
                await db.users.update_one(
                    {"email": email},
                    {"$set": {"school_id": school_id, "role": "teacher"}}
                )
                created += 1
            else:
                errors.append(f"User {email} already belongs to another school")
            continue
        
        user_doc = {
            "user_id": f"user_{uuid.uuid4().hex[:12]}",
            "email": email,
            "name": name,
            "role": "teacher",
            "school_id": school_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by_school": True
        }
        await db.users.insert_one(user_doc)
        created += 1
    
    return {"created": created, "errors": errors}

@router.post("/school/upload/students")
async def school_upload_students(request: Request):
    """Bulk upload students via CSV data"""
    from services.auth import require_school
    db = get_db()
    school = await require_school(request)
    school_id = school["school_id"]
    
    body = await request.json()
    csv_data = body.get("data", [])
    
    created = 0
    errors = []
    
    for row in csv_data:
        name = row.get("name", "").strip()
        email = row.get("email", "").strip().lower()
        grade = row.get("grade", 0)
        
        if isinstance(grade, str):
            try:
                grade = int(grade)
            except:
                grade = 0
        
        if not name or not email:
            errors.append(f"Missing name or email: {row}")
            continue
        
        existing = await db.users.find_one({"email": email})
        if existing:
            errors.append(f"User {email} already exists")
            continue
        
        user_id = f"user_{uuid.uuid4().hex[:12]}"
        user_doc = {
            "user_id": user_id,
            "email": email,
            "name": name,
            "role": "child",
            "grade": grade,
            "school_id": school_id,
            "streak_count": 0,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by_school": True
        }
        await db.users.insert_one(user_doc)
        
        for account_type in ["spending", "savings", "investing", "gifting"]:
            wallet_doc = {
                "account_id": f"acc_{uuid.uuid4().hex[:12]}",
                "user_id": user_id,
                "account_type": account_type,
                "balance": 100.0 if account_type == "spending" else 0.0,
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            await db.wallet_accounts.insert_one(wallet_doc)
        
        created += 1
    
    return {"created": created, "errors": errors}

@router.post("/school/upload/parents")
async def school_upload_parents(request: Request):
    """Bulk upload parents via CSV data"""
    from services.auth import require_school
    db = get_db()
    school = await require_school(request)
    school_id = school["school_id"]
    
    body = await request.json()
    csv_data = body.get("data", [])
    
    created = 0
    errors = []
    
    for row in csv_data:
        name = row.get("name", "").strip()
        email = row.get("email", "").strip().lower()
        
        if not name or not email:
            errors.append(f"Missing name or email: {row}")
            continue
        
        existing = await db.users.find_one({"email": email})
        if existing:
            if not existing.get("school_id"):
                await db.users.update_one(
                    {"email": email},
                    {"$set": {"school_id": school_id}}
                )
                created += 1
            continue
        
        user_doc = {
            "user_id": f"user_{uuid.uuid4().hex[:12]}",
            "email": email,
            "name": name,
            "role": "parent",
            "school_id": school_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "created_by_school": True
        }
        await db.users.insert_one(user_doc)
        created += 1
    
    return {"created": created, "errors": errors}
