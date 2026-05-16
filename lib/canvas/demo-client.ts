import type {
  CanvasUser,
  CanvasCourse,
  CanvasAssignment,
  CanvasCalendarEvent,
  CanvasEnrollment,
  CanvasAnnouncement,
  CanvasModule,
} from "./types";
import coursesFixture from "./fixtures/courses.json";
import assignmentsFixture from "./fixtures/assignments.json";
import announcementsFixture from "./fixtures/announcements.json";
import gradesFixture from "./fixtures/grades.json";
import calendarFixture from "./fixtures/calendar.json";
import modulesFixture from "./fixtures/modules.json";

const courses = coursesFixture as CanvasCourse[];
const assignments = assignmentsFixture as CanvasAssignment[];
const announcements = announcementsFixture as CanvasAnnouncement[];
const grades = gradesFixture as CanvasEnrollment[];
const calendar = calendarFixture as CanvasCalendarEvent[];

interface ModuleWithCourse extends CanvasModule {
  course_id: number;
}
const modules = modulesFixture as ModuleWithCourse[];

export class DemoCanvasClient {
  async validateAndGetUser(): Promise<CanvasUser> {
    return {
      id: 99999,
      name: "Demo Student",
      email: "demo@university.edu",
      login_id: "demo",
    };
  }

  async listCourses(): Promise<CanvasCourse[]> {
    return courses;
  }

  async listAssignments(params?: {
    courseId?: number;
    dueBefore?: string;
    dueAfter?: string;
  }): Promise<CanvasAssignment[]> {
    let result = assignments;
    if (params?.courseId) {
      result = result.filter((a) => a.course_id === params.courseId);
    }
    if (params?.dueBefore) {
      result = result.filter((a) => a.due_at && a.due_at <= params.dueBefore!);
    }
    if (params?.dueAfter) {
      result = result.filter((a) => a.due_at && a.due_at >= params.dueAfter!);
    }
    return result;
  }

  async getAssignment(
    courseId: number,
    assignmentId: number
  ): Promise<CanvasAssignment> {
    const found = assignments.find(
      (a) => a.course_id === courseId && a.id === assignmentId
    );
    if (!found) throw new Error(`Assignment ${assignmentId} not found`);
    return found;
  }

  async getCalendar(
    startDate: string,
    endDate: string
  ): Promise<CanvasCalendarEvent[]> {
    return calendar.filter(
      (e) => e.start_at >= startDate && e.start_at <= endDate
    );
  }

  async getGrades(): Promise<CanvasEnrollment[]> {
    return grades;
  }

  async listAnnouncements(courseId?: number): Promise<CanvasAnnouncement[]> {
    if (!courseId) return announcements;
    return announcements.filter(
      (a) => a.context_code === `course_${courseId}`
    );
  }

  async listModules(courseId: number): Promise<CanvasModule[]> {
    return modules
      .filter((m) => m.course_id === courseId)
      .map(({ course_id: _cid, ...rest }) => rest as CanvasModule);
  }
}
