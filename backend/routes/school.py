"""School-related routes - Admin management and School dashboard"""
from fastapi import APIRouter, HTTPException, Request
from datetime import datetime, timezone
import uuid
import hashlib

from core.database import db
from services.auth import require_admin, require_school
from models.school import SchoolCreate

router = APIRouter(tags=["school"])

# ============== ADMIN SCHOOL MANAGEMENT ==============

@router.post("/admin/schools")
async def admin_create_school(data: SchoolCreate, request: Request):
    """Create a new school (admin only)"""
    await require_admin(request)
    
    # Check if username already exists
    existing = await db.schools.find_one({"username": data.username})
    if existing:
        raise HTTPException(status_code=400, detail="Username already taken")
    
    school_id = f"school_{uuid.uuid4().hex[:12]}"
    password_hash = hashlib.sha256(data.password.encode()).hexdigest()
    
    school_doc = {
        "school_id": school_id,
        "name": data.name,
        "username": data.username,
        "password_hash": password_hash,
        "address": data.address,
        "contact_email": data.contact_email,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.schools.insert_one(school_doc)
    
    return {
        "school_id": school_id,
        "message": f"School '{data.name}' created successfully"
    }

@router.get("/admin/schools")
async def admin_get_schools(request: Request):
    """Get all schools (admin only)"""
    await require_admin(request)
    
    schools = await db.schools.find({}, {"_id": 0, "password_hash": 0}).to_list(100)
    
    # Add stats for each school
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
    await require_admin(request)
    
    school = await db.schools.find_one({"school_id": school_id})
    if not school:
        raise HTTPException(status_code=404, detail="School not found")
    
    # Remove school_id from all users
    await db.users.update_many(
        {"school_id": school_id},
        {"$unset": {"school_id": ""}}
    )
    
    # Delete school
    await db.schools.delete_one({"school_id": school_id})
    
    return {"message": f"School '{school['name']}' deleted"}

# ============== SCHOOL DASHBOARD ==============

@router.get("/school/dashboard")
async def get_school_dashboard(request: Request):
    """Get school dashboard overview"""
    school = await require_school(request)
    school_id = school["school_id"]
    
    # Get teachers
    teachers = await db.users.find(
        {"school_id": school_id, "role": "teacher"},
        {"_id": 0, "password": 0}
    ).to_list(500)
    
    # Get students
    students = await db.users.find(
        {"school_id": school_id, "role": "child"},
        {"_id": 0, "password": 0}
    ).to_list(1000)
    
    # Get classrooms for this school's teachers
    teacher_ids = [t["user_id"] for t in teachers]
    classrooms = await db.classrooms.find(
        {"teacher_id": {"$in": teacher_ids}},
        {"_id": 0}
    ).to_list(500)
    
    # Get classroom-student links
    classroom_ids = [c["classroom_id"] for c in classrooms]
    classroom_students = await db.classroom_students.find(
        {"classroom_id": {"$in": classroom_ids}},
        {"_id": 0}
    ).to_list(5000)
    
    # Map students to classrooms
    student_classroom_map = {}
    for link in classroom_students:
        student_classroom_map[link["student_id"]] = link["classroom_id"]
    
    # Add teacher name and classroom to students
    for student in students:
        for classroom in classrooms:
            if student["user_id"] in [s.get("student_id") for s in await db.classroom_students.find({"classroom_id": classroom["classroom_id"]}).to_list(100)]:
                student["teacher_name"] = next((t["name"] for t in teachers if t["user_id"] == classroom["teacher_id"]), "Unknown")
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
    school = await require_school(request)
    school_id = school["school_id"]
    
    # Get all students
    students = await db.users.find(
        {"school_id": school_id, "role": "child"},
        {"_id": 0}
    ).to_list(1000)
    
    if not students:
        return {"students": [], "count": 0}
    
    # Get teachers for mapping
    teachers = await db.users.find(
        {"school_id": school_id, "role": "teacher"},
        {"_id": 0, "user_id": 1, "name": 1}
    ).to_list(500)
    teacher_map = {t["user_id"]: t["name"] for t in teachers}
    
    # Get classrooms
    classrooms = await db.classrooms.find(
        {"teacher_id": {"$in": list(teacher_map.keys())}},
        {"_id": 0}
    ).to_list(500)
    
    # Build student-teacher mapping via classroom_students
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
        
        # Wallet balance
        wallets = await db.wallet_accounts.find(
            {"user_id": student_id},
            {"_id": 0}
        ).to_list(10)
        total_balance = sum(w.get("balance", 0) for w in wallets)
        
        # Lessons completed
        lessons = await db.user_content_progress.count_documents({
            "user_id": student_id,
            "completed": True
        })
        
        # Quests completed
        quests = await db.quest_completions.count_documents({
            "user_id": student_id,
            "is_completed": True
        })
        
        # Get teacher info
        teacher_info = student_teacher_map.get(student_id, {"teacher_name": "Unassigned", "classroom_name": "-"})
        
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
    
    # Sort by lessons completed descending
    comparison_data.sort(key=lambda x: x["lessons_completed"], reverse=True)
    
    return {
        "students": comparison_data,
        "count": len(comparison_data)
    }

# ============== SCHOOL BULK UPLOAD ==============

@router.post("/school/upload/teachers")
async def school_upload_teachers(request: Request):
    """Bulk upload teachers via CSV data"""
    school = await require_school(request)
    school_id = school["school_id"]
    
    body = await request.json()
    csv_data = body.get("data", [])  # List of {name, email}
    
    created = 0
    errors = []
    
    for row in csv_data:
        name = row.get("name", "").strip()
        email = row.get("email", "").strip().lower()
        
        if not name or not email:
            errors.append(f"Missing name or email: {row}")
            continue
        
        # Check if user exists
        existing = await db.users.find_one({"email": email})
        if existing:
            # Update school_id if not set
            if not existing.get("school_id"):
                await db.users.update_one(
                    {"email": email},
                    {"$set": {"school_id": school_id, "role": "teacher"}}
                )
                created += 1
            else:
                errors.append(f"User {email} already belongs to another school")
            continue
        
        # Create new user
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
    school = await require_school(request)
    school_id = school["school_id"]
    
    body = await request.json()
    csv_data = body.get("data", [])  # List of {name, email, grade}
    
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
        
        # Check if user exists
        existing = await db.users.find_one({"email": email})
        if existing:
            errors.append(f"User {email} already exists")
            continue
        
        # Create new student
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
        
        # Create wallet accounts
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
    school = await require_school(request)
    school_id = school["school_id"]
    
    body = await request.json()
    csv_data = body.get("data", [])  # List of {name, email}
    
    created = 0
    errors = []
    
    for row in csv_data:
        name = row.get("name", "").strip()
        email = row.get("email", "").strip().lower()
        
        if not name or not email:
            errors.append(f"Missing name or email: {row}")
            continue
        
        # Check if user exists
        existing = await db.users.find_one({"email": email})
        if existing:
            # Update school_id
            if not existing.get("school_id"):
                await db.users.update_one(
                    {"email": email},
                    {"$set": {"school_id": school_id}}
                )
                created += 1
            continue
        
        # Create new user
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
