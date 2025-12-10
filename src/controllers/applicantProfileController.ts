import { Response } from "express";
import { z } from "zod";
import prisma from "../config/database";
import { ApplicantAuthRequest } from "../types/express";
import { Request } from "express";
import { sendApplicationReceivedEmail } from "../utils/email";

// Schema for updating applicant profile/application
const updateApplicationSchema = z.object({
  phone: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.enum(["MALE", "FEMALE", "OTHER"]).optional(),
  address: z
    .string()
    .min(10, "Address must be at least 10 characters")
    .optional(),
  previousSchool: z.string().optional(),
  gradeAverage: z.number().min(0).max(100).optional(),
});

// Get all programs, optionally filtered by department (public endpoint for form dropdowns)
export const getPrograms = async (req: Request, res: Response) => {
  try {
    const { departmentId } = req.query;

    const programs = await prisma.program.findMany({
      where: departmentId
        ? { departmentId: parseInt(departmentId as string) }
        : undefined,
      select: {
        id: true,
        name: true,
        code: true,
        departmentId: true,
        duration: true,
      },
      orderBy: {
        name: "asc",
      },
    });

    res.json(programs);
  } catch (error) {
    console.error("Get programs error:", error);
    res.status(500).json({ message: "Failed to fetch programs" });
  }
};

// Get applicant profile
export const getProfile = async (req: ApplicantAuthRequest, res: Response) => {
  try {
    const applicantId = req.applicant?.id;

    if (!applicantId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const applicant = await prisma.applicant.findUnique({
      where: { id: applicantId },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        dateOfBirth: true,
        gender: true,
        address: true,
        previousSchool: true,
        gradeAverage: true,
        programType: true,
        departmentId: true,
        programId: true,
        applicationFeePaid: true,
        acceptanceFeePaid: true,
        department: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        program: {
          select: {
            id: true,
            name: true,
            code: true,
          },
        },
        admissionDecision: {
          select: {
            status: true,
          },
        },
        matricNumber: {
          select: {
            matricNo: true,
          },
        },
        createdAt: true,
      },
    });

    if (!applicant) {
      return res.status(404).json({ message: "Applicant not found" });
    }

    res.json({
      ...applicant,
      applicationStatus: applicant.admissionDecision?.status || "INCOMPLETE",
      hasMatricNumber: !!applicant.matricNumber,
      matricNo: applicant.matricNumber?.matricNo || null,
    });
  } catch (error) {
    console.error("Get profile error:", error);
    res.status(500).json({ message: "Failed to fetch profile" });
  }
};

// Update applicant profile
export const updateProfile = async (
  req: ApplicantAuthRequest,
  res: Response
) => {
  try {
    const applicantId = req.applicant?.id;

    if (!applicantId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Validate request body
    const validation = updateApplicationSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: validation.error.errors,
      });
    }

    const data = validation.data;

    // Update applicant
    const updatedApplicant = await prisma.applicant.update({
      where: { id: applicantId },
      data: {
        ...(data.phone && { phone: data.phone }),
        ...(data.dateOfBirth && { dateOfBirth: new Date(data.dateOfBirth) }),
        ...(data.gender && { gender: data.gender }),
        ...(data.address && { address: data.address }),
        ...(data.previousSchool && { previousSchool: data.previousSchool }),
        ...(data.gradeAverage !== undefined && {
          gradeAverage: data.gradeAverage,
        }),
      },
      select: {
        id: true,
        username: true,
        firstName: true,
        lastName: true,
        email: true,
        phone: true,
        dateOfBirth: true,
        gender: true,
        address: true,
        previousSchool: true,
        gradeAverage: true,
        admissionDecision: {
          select: {
            status: true,
          },
        },
        matricNumber: {
          select: {
            matricNo: true,
          },
        },
      },
    });

    res.json({
      message: "Profile updated successfully",
      applicant: {
        ...updatedApplicant,
        applicationStatus:
          updatedApplicant.admissionDecision?.status || "INCOMPLETE",
        hasMatricNumber: !!updatedApplicant.matricNumber,
        matricNo: updatedApplicant.matricNumber?.matricNo || null,
      },
    });
  } catch (error) {
    console.error("Update profile error:", error);
    res.status(500).json({ message: "Failed to update profile" });
  }
};

// Submit complete application
export const submitApplication = async (
  req: ApplicantAuthRequest,
  res: Response
) => {
  try {
    const applicantId = req.applicant?.id;

    if (!applicantId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    // Validate required fields for application submission
    const applicationSchema = z.object({
      phone: z.string().min(1, "Phone is required"),
      dateOfBirth: z.string().min(1, "Date of birth is required"),
      gender: z.enum(["MALE", "FEMALE", "OTHER"], {
        required_error: "Gender is required",
      }),
      address: z.string().min(10, "Address must be at least 10 characters"),
      previousSchool: z.string().min(1, "Previous school is required"),
      gradeAverage: z.number().min(0).max(100),
      programType: z.enum(["ND", "HND", "BSC", "MSC", "PHD"], {
        required_error: "Program type is required",
      }),
      departmentId: z.number({ required_error: "Department is required" }),
      programId: z.number({ required_error: "Program is required" }),
    });

    const validation = applicationSchema.safeParse(req.body);
    if (!validation.success) {
      return res.status(400).json({
        message: "Validation failed",
        errors: validation.error.errors,
      });
    }

    const data = validation.data;

    // Verify program belongs to department
    const program = await prisma.program.findFirst({
      where: {
        id: data.programId,
        departmentId: data.departmentId,
      },
    });

    if (!program) {
      return res.status(400).json({
        message: "Invalid program selection for the selected department",
      });
    }

    // Check if applicant exists and current admission decision status
    const applicant = await prisma.applicant.findUnique({
      where: { id: applicantId },
      select: {
        admissionDecision: {
          select: {
            status: true,
          },
        },
      },
    });

    if (!applicant) {
      return res.status(404).json({ message: "Applicant not found" });
    }

    const currentStatus = applicant.admissionDecision?.status || "INCOMPLETE";

    // If already submitted (PENDING or APPROVED), don't allow resubmission
    if (currentStatus === "PENDING") {
      return res.status(400).json({
        message:
          "Application already submitted and is pending review. Please wait for the admission decision.",
      });
    }

    if (currentStatus === "APPROVED") {
      return res.status(400).json({
        message: "Your application has been approved. You cannot resubmit.",
      });
    }

    // Only allow submission if status is INCOMPLETE or REJECTED

    // Check if phone number is already used by another applicant
    const phoneExists = await prisma.applicant.findFirst({
      where: {
        phone: data.phone,
        id: { not: applicantId },
      },
    });

    if (phoneExists) {
      return res.status(400).json({
        message: "An application with this phone number already exists.",
      });
    }

    // Use transaction to ensure both updates succeed together
    const result = await prisma.$transaction(async (tx: any) => {
      // Update applicant with complete application data
      const updatedApplicant = await tx.applicant.update({
        where: { id: applicantId },
        data: {
          phone: data.phone,
          dateOfBirth: new Date(data.dateOfBirth),
          gender: data.gender,
          address: data.address,
          previousSchool: data.previousSchool,
          gradeAverage: data.gradeAverage,
          programType: data.programType,
          departmentId: data.departmentId,
          programId: data.programId,
        },
        select: {
          id: true,
          username: true,
          firstName: true,
          lastName: true,
          email: true,
          phone: true,
          dateOfBirth: true,
          gender: true,
          address: true,
          previousSchool: true,
          gradeAverage: true,
          programType: true,
          departmentId: true,
          programId: true,
          department: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          program: {
            select: {
              id: true,
              name: true,
              code: true,
            },
          },
          admissionDecision: {
            select: {
              status: true,
            },
          },
          matricNumber: {
            select: {
              matricNo: true,
            },
          },
        },
      });

      // Create or update admission decision to PENDING
      await tx.admissionDecision.upsert({
        where: { applicantId },
        create: {
          applicantId,
          status: "PENDING",
        },
        update: {
          status: "PENDING",
        },
      });

      return updatedApplicant;
    });

    // Send application received email
    await sendApplicationReceivedEmail(
      result.email,
      result.firstName,
      result.lastName
    );
    res.json({
      message: "Application submitted successfully",
      applicant: {
        ...result,
        applicationStatus: "PENDING",
        hasMatricNumber: !!result.matricNumber,
        matricNo: result.matricNumber?.matricNo || null,
      },
    });
  } catch (error) {
    console.error("Submit application error:", error);
    res.status(500).json({ message: "Failed to submit application" });
  }
};

// Get application status
export const getApplicationStatus = async (
  req: ApplicantAuthRequest,
  res: Response
) => {
  try {
    const applicantId = req.applicant?.id;

    if (!applicantId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const applicant = await prisma.applicant.findUnique({
      where: { id: applicantId },
      select: {
        dateOfBirth: true,
        gender: true,
        address: true,
        previousSchool: true,
        gradeAverage: true,
        admissionDecision: {
          select: {
            status: true,
          },
        },
        matricNumber: {
          select: {
            matricNo: true,
          },
        },
      },
    });

    if (!applicant) {
      return res.status(404).json({ message: "Applicant not found" });
    }

    // Check if application is complete
    const isComplete =
      !!applicant.dateOfBirth &&
      !!applicant.gender &&
      !!applicant.address &&
      !!applicant.previousSchool &&
      applicant.gradeAverage !== null;

    const status = applicant.admissionDecision?.status || "INCOMPLETE";

    res.json({
      status,
      isComplete,
      hasMatricNumber: !!applicant.matricNumber,
      matricNo: applicant.matricNumber?.matricNo || null,
    });
  } catch (error) {
    console.error("Get application status error:", error);
    res.status(500).json({ message: "Failed to fetch application status" });
  }
};
