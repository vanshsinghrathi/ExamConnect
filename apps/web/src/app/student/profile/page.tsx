"use client";

import {
  FormEvent,
  useEffect,
  useState,
} from "react";
import { useRouter } from "next/navigation";
import styles from "./profile.module.css";

type StudentProfile = {
  id: number;
  userId: number;
  firstName: string;
  lastName: string | null;
  dateOfBirth: string | null;
  gender: string | null;
  state: string | null;
  category: string | null;
};

type EducationRecord = {
  id: number;
  studentProfileId: number;
  qualification: string;
  courseName: string | null;
  institutionName: string | null;
  boardOrUniversity: string | null;
  passingYear: number | null;
  percentage: number | null;
  stream: string | null;
};

type EducationForm = {
  qualification: string;
  courseName: string;
  institutionName: string;
  boardOrUniversity: string;
  passingYear: string;
  percentage: string;
  stream: string;
};

type ProfileForm = {
  firstName: string;
  lastName: string;
  dateOfBirth: string;
  gender: string;
  state: string;
  category: string;
};

const API_URL =
  process.env.NEXT_PUBLIC_API_URL ??
  "http://localhost:4000";

const emptyEducation: EducationForm = {
  qualification: "",
  courseName: "",
  institutionName: "",
  boardOrUniversity: "",
  passingYear: "",
  percentage: "",
  stream: "",
};

export default function StudentProfilePage() {
  const router = useRouter();

  const [profile, setProfile] =
    useState<ProfileForm>({
      firstName: "",
      lastName: "",
      dateOfBirth: "",
      gender: "",
      state: "",
      category: "",
    });

  const [education, setEducation] =
    useState<EducationRecord[]>([]);

  const [educationForm, setEducationForm] =
    useState<EducationForm>(
      emptyEducation,
    );

  const [editingEducationId, setEditingEducationId] =
    useState<number | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [savingProfile, setSavingProfile] =
    useState(false);

  const [savingEducation, setSavingEducation] =
    useState(false);

  const [deletingEducationId, setDeletingEducationId] =
    useState<number | null>(null);

  const [message, setMessage] =
    useState<string | null>(null);

  const [error, setError] =
    useState<string | null>(null);

  useEffect(() => {
    async function loadProfile() {
      try {
        setLoading(true);
        setError(null);

        const [
          profileResponse,
          educationResponse,
        ] = await Promise.all([
          fetch(
            `${API_URL}/student/profile`,
            {
              credentials: "include",
              cache: "no-store",
            },
          ),
          fetch(
            `${API_URL}/student/education`,
            {
              credentials: "include",
              cache: "no-store",
            },
          ),
        ]);

        if (
          profileResponse.status === 401 ||
          educationResponse.status === 401
        ) {
          router.push("/");
          return;
        }

        if (profileResponse.ok) {
          const data =
            (await profileResponse.json()) as {
              profile: StudentProfile;
            };

          setProfile({
            firstName:
              data.profile.firstName ?? "",
            lastName:
              data.profile.lastName ?? "",
            dateOfBirth:
              data.profile.dateOfBirth
                ? data.profile.dateOfBirth.slice(
                    0,
                    10,
                  )
                : "",
            gender:
              data.profile.gender ?? "",
            state:
              data.profile.state ?? "",
            category:
              data.profile.category ?? "",
          });
        }

        if (educationResponse.ok) {
          const data =
            (await educationResponse.json()) as {
              education: EducationRecord[];
            };

          setEducation(
            data.education ?? [],
          );
        }
      } catch {
        setError(
          "Unable to load your profile.",
        );
      } finally {
        setLoading(false);
      }
    }

    void loadProfile();
  }, [router]);

  function updateProfile(
    field: keyof ProfileForm,
    value: string,
  ) {
    setProfile((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function updateEducation(
    field: keyof EducationForm,
    value: string,
  ) {
    setEducationForm(
      (current) => ({
        ...current,
        [field]: value,
      }),
    );
  }

  function startEditingEducation(
    record: EducationRecord,
  ) {
    setEditingEducationId(record.id);

    setEducationForm({
      qualification:
        record.qualification ?? "",
      courseName:
        record.courseName ?? "",
      institutionName:
        record.institutionName ?? "",
      boardOrUniversity:
        record.boardOrUniversity ?? "",
      passingYear:
        record.passingYear !== null
          ? String(record.passingYear)
          : "",
      percentage:
        record.percentage !== null
          ? String(record.percentage)
          : "",
      stream:
        record.stream ?? "",
    });

    setError(null);
    setMessage(null);

    window.scrollTo({
      top: document.body.scrollHeight,
      behavior: "smooth",
    });
  }

  function cancelEditingEducation() {
    setEditingEducationId(null);
    setEducationForm(
      emptyEducation,
    );
    setError(null);
    setMessage(null);
  }

  async function saveProfile(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setSavingProfile(true);
      setError(null);
      setMessage(null);

      const response = await fetch(
        `${API_URL}/student/profile`,
        {
          method: "PUT",
          credentials: "include",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify({
            firstName:
              profile.firstName,
            lastName:
              profile.lastName ||
              undefined,
            dateOfBirth:
              profile.dateOfBirth
                ? `${profile.dateOfBirth}T00:00:00.000Z`
                : undefined,
            gender:
              profile.gender ||
              undefined,
            state:
              profile.state ||
              undefined,
            category:
              profile.category ||
              undefined,
          }),
        },
      );

      const data =
        (await response.json()) as {
          message?: string;
        };

      if (!response.ok) {
        throw new Error(
          data.message ??
            "Unable to save profile.",
        );
      }

      setMessage(
        "Profile saved successfully. Your eligibility will be recalculated when you check your exams.",
      );
    } catch (
      saveProfileError
    ) {
      setError(
        saveProfileError instanceof Error
          ? saveProfileError.message
          : "Unable to save profile.",
      );
    } finally {
      setSavingProfile(false);
    }
  }

  async function saveEducation(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    try {
      setSavingEducation(true);
      setError(null);
      setMessage(null);

      const payload = {
        qualification:
          educationForm.qualification,
        courseName:
          educationForm.courseName ||
          undefined,
        institutionName:
          educationForm.institutionName ||
          undefined,
        boardOrUniversity:
          educationForm.boardOrUniversity ||
          undefined,
        passingYear:
          educationForm.passingYear
            ? Number(
                educationForm.passingYear,
              )
            : undefined,
        percentage:
          educationForm.percentage
            ? Number(
                educationForm.percentage,
              )
            : undefined,
        stream:
          educationForm.stream ||
          undefined,
      };

      /*
       * EDIT EXISTING EDUCATION
       */
      if (
        editingEducationId !== null
      ) {
        const response = await fetch(
          `${API_URL}/student/education/${editingEducationId}`,
          {
            method: "PUT",
            credentials: "include",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify(
              payload,
            ),
          },
        );

        const data =
          (await response.json()) as {
            education?: EducationRecord;
            message?: string;
          };

        if (
          !response.ok ||
          !data.education
        ) {
          throw new Error(
            data.message ??
              "Unable to update education.",
          );
        }

        setEducation(
          (current) =>
            current.map(
              (record) =>
                record.id ===
                editingEducationId
                  ? data.education!
                  : record,
            ),
        );

        setEditingEducationId(
          null,
        );

        setEducationForm(
          emptyEducation,
        );

        setMessage(
          "Education record updated successfully. Your eligibility will be recalculated when you check your exams.",
        );

        return;
      }

      /*
       * ADD NEW EDUCATION
       */
      const response = await fetch(
        `${API_URL}/student/education`,
        {
          method: "POST",
          credentials: "include",
          headers: {
            "Content-Type":
              "application/json",
          },
          body: JSON.stringify(
            payload,
          ),
        },
      );

      const data =
        (await response.json()) as {
          education?: EducationRecord;
          message?: string;
        };

      if (
        !response.ok ||
        !data.education
      ) {
        throw new Error(
          data.message ??
            "Unable to save education.",
        );
      }

      setEducation(
        (current) => [
          ...current,
          data.education!,
        ],
      );

      setEducationForm(
        emptyEducation,
      );

      setMessage(
        "Education added successfully. Your eligibility will be recalculated when you check your exams.",
      );
    } catch (
      saveEducationError
    ) {
      setError(
        saveEducationError instanceof
          Error
          ? saveEducationError.message
          : "Unable to save education.",
      );
    } finally {
      setSavingEducation(false);
    }
  }

  async function deleteEducation(
    id: number,
  ) {
    const confirmed =
      window.confirm(
        "Delete this education record?",
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingEducationId(id);
      setError(null);
      setMessage(null);

      const response = await fetch(
        `${API_URL}/student/education/${id}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );

      const data =
        (await response.json()) as {
          status?: string;
          message?: string;
          deletedId?: number;
          error?: string;
        };

      if (!response.ok) {
        throw new Error(
          data.message ??
            "Unable to delete education.",
        );
      }

      if (
        data.deletedId !== undefined &&
        data.deletedId !== id
      ) {
        throw new Error(
          "The server deleted a different education record.",
        );
      }

      /*
       * Reload the education list from
       * the backend/database.
       */
      const educationResponse =
        await fetch(
          `${API_URL}/student/education`,
          {
            method: "GET",
            credentials: "include",
            cache: "no-store",
          },
        );

      if (
        educationResponse.status === 401
      ) {
        router.push("/");
        return;
      }

      if (!educationResponse.ok) {
        throw new Error(
          "Education was deleted, but the updated education list could not be loaded.",
        );
      }

      const educationData =
        (await educationResponse.json()) as {
          education: EducationRecord[];
        };

      setEducation(
        educationData.education ?? [],
      );

      setMessage(
        "Education record deleted successfully.",
      );
    } catch (
      deleteEducationError
    ) {
      setError(
        deleteEducationError instanceof
          Error
          ? deleteEducationError.message
          : "Unable to delete education.",
      );
    } finally {
      setDeletingEducationId(null);
    }
  }

  function goToDashboard() {
    router.push("/");
  }

  if (loading) {
    return (
      <main
        className={styles.page}
      >
        <section
          className={styles.loadingCard}
        >
          Loading your profile...
        </section>
      </main>
    );
  }

  const isEditing =
    editingEducationId !== null;

  return (
    <main className={styles.page}>
      <header
        className={styles.header}
      >
        <div>
          <button
            type="button"
            className={
              styles.backButton
            }
            onClick={goToDashboard}
          >
            ← Dashboard
          </button>

          <p
            className={
              styles.eyebrow
            }
          >
            EXAMCONNECT
          </p>

          <h1>
            Student Profile
          </h1>

          <p
            className={
              styles.subtitle
            }
          >
            Keep your personal and education
            details updated. ExamConnect uses
            them to determine which government
            exams you qualify for.
          </p>
        </div>
      </header>

      {error && (
        <div
          className={
            styles.errorMessage
          }
        >
          {error}
        </div>
      )}

      {message && (
        <div
          className={
            styles.successMessage
          }
        >
          {message}
        </div>
      )}

      <section
        className={styles.card}
      >
        <div
          className={
            styles.cardHeader
          }
        >
          <div>
            <p
              className={
                styles.cardEyebrow
              }
            >
              STEP 1
            </p>

            <h2>
              Personal Information
            </h2>
          </div>
        </div>

        <form
          className={styles.form}
          onSubmit={saveProfile}
        >
          <div
            className={
              styles.formGrid
            }
          >
            <label>
              First Name *
              <input
                value={
                  profile.firstName
                }
                onChange={(event) =>
                  updateProfile(
                    "firstName",
                    event.target.value,
                  )
                }
                required
              />
            </label>

            <label>
              Last Name
              <input
                value={
                  profile.lastName
                }
                onChange={(event) =>
                  updateProfile(
                    "lastName",
                    event.target.value,
                  )
                }
              />
            </label>

            <label>
              Date of Birth
              <input
                type="date"
                value={
                  profile.dateOfBirth
                }
                onChange={(event) =>
                  updateProfile(
                    "dateOfBirth",
                    event.target.value,
                  )
                }
              />
            </label>

            <label>
              Gender
              <select
                value={
                  profile.gender
                }
                onChange={(event) =>
                  updateProfile(
                    "gender",
                    event.target.value,
                  )
                }
              >
                <option value="">
                  Select gender
                </option>
                <option value="Male">
                  Male
                </option>
                <option value="Female">
                  Female
                </option>
                <option value="Other">
                  Other
                </option>
              </select>
            </label>

            <label>
              State
              <input
                value={
                  profile.state
                }
                onChange={(event) =>
                  updateProfile(
                    "state",
                    event.target.value,
                  )
                }
                placeholder="e.g. Delhi"
              />
            </label>

            <label>
              Category
              <select
                value={
                  profile.category
                }
                onChange={(event) =>
                  updateProfile(
                    "category",
                    event.target.value,
                  )
                }
              >
                <option value="">
                  Select category
                </option>
                <option value="General">
                  General
                </option>
                <option value="OBC">
                  OBC
                </option>
                <option value="SC">
                  SC
                </option>
                <option value="ST">
                  ST
                </option>
                <option value="EWS">
                  EWS
                </option>
              </select>
            </label>
          </div>

          <button
            type="submit"
            className={
              styles.primaryButton
            }
            disabled={savingProfile}
          >
            {savingProfile
              ? "Saving..."
              : "Save Profile"}
          </button>
        </form>
      </section>

      <section
        className={styles.card}
      >
        <div
          className={
            styles.cardHeader
          }
        >
          <div>
            <p
              className={
                styles.cardEyebrow
              }
            >
              STEP 2
            </p>

            <h2>
              Education
            </h2>
          </div>
        </div>

        {education.length > 0 && (
          <div
            className={
              styles.educationList
            }
          >
            {education.map(
              (record) => (
                <article
                  key={record.id}
                  className={
                    styles.educationItem
                  }
                >
                  <div>
                    <h3>
                      {
                        record.qualification
                      }
                    </h3>

                    {record.courseName && (
                      <p>
                        {
                          record.courseName
                        }
                      </p>
                    )}

                    {record.stream && (
                      <p>
                        Stream:{" "}
                        {
                          record.stream
                        }
                      </p>
                    )}

                    {record.institutionName && (
                      <p>
                        {
                          record.institutionName
                        }
                      </p>
                    )}

                    {record.passingYear && (
                      <p>
                        Passing Year:{" "}
                        {
                          record.passingYear
                        }
                      </p>
                    )}

                    {record.percentage !==
                      null && (
                      <p>
                        Percentage:{" "}
                        {
                          record.percentage
                        }%
                      </p>
                    )}
                  </div>

                  <div
                    className={
                      styles.educationActions
                    }
                  >
                    <button
                      type="button"
                      className={
                        styles.editButton
                      }
                      onClick={() =>
                        startEditingEducation(
                          record,
                        )
                      }
                      disabled={
                        deletingEducationId !==
                        null ||
                        savingEducation
                      }
                    >
                      Edit
                    </button>

                    <button
                      type="button"
                      className={
                        styles.deleteButton
                      }
                      onClick={() =>
                        deleteEducation(
                          record.id,
                        )
                      }
                      disabled={
                        deletingEducationId ===
                        record.id ||
                        savingEducation
                      }
                    >
                      {deletingEducationId ===
                      record.id
                        ? "Deleting..."
                        : "Delete"}
                    </button>
                  </div>
                </article>
              ),
            )}
          </div>
        )}

        <form
          className={styles.form}
          onSubmit={saveEducation}
        >
          <h3
            className={
              styles.addEducationTitle
            }
          >
            {isEditing
              ? "Edit Education"
              : "Add Education"}
          </h3>

          <div
            className={
              styles.formGrid
            }
          >
            <label>
              Qualification *
              <input
                value={
                  educationForm.qualification
                }
                onChange={(event) =>
                  updateEducation(
                    "qualification",
                    event.target.value,
                  )
                }
                placeholder="e.g. B.Voc, M.Sc, B.Tech"
                required
              />
            </label>

            <label>
              Course Name
              <input
                value={
                  educationForm.courseName
                }
                onChange={(event) =>
                  updateEducation(
                    "courseName",
                    event.target.value,
                  )
                }
                placeholder="e.g. Master of Science"
              />
            </label>

            <label>
              Stream
              <input
                value={
                  educationForm.stream
                }
                onChange={(event) =>
                  updateEducation(
                    "stream",
                    event.target.value,
                  )
                }
                placeholder="e.g. Physics"
              />
            </label>

            <label>
              Passing Year
              <input
                type="number"
                min="1900"
                max="2100"
                value={
                  educationForm.passingYear
                }
                onChange={(event) =>
                  updateEducation(
                    "passingYear",
                    event.target.value,
                  )
                }
              />
            </label>

            <label>
              Percentage
              <input
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={
                  educationForm.percentage
                }
                onChange={(event) =>
                  updateEducation(
                    "percentage",
                    event.target.value,
                  )
                }
                placeholder="e.g. 85.2"
              />
            </label>

            <label>
              Institution
              <input
                value={
                  educationForm.institutionName
                }
                onChange={(event) =>
                  updateEducation(
                    "institutionName",
                    event.target.value,
                  )
                }
              />
            </label>

            <label
              className={
                styles.fullWidth
              }
            >
              Board / University
              <input
                value={
                  educationForm.boardOrUniversity
                }
                onChange={(event) =>
                  updateEducation(
                    "boardOrUniversity",
                    event.target.value,
                  )
                }
              />
            </label>
          </div>

          <div
            className={
              styles.educationFormActions
            }
          >
            <button
              type="submit"
              className={
                styles.primaryButton
              }
              disabled={savingEducation}
            >
              {savingEducation
                ? isEditing
                  ? "Updating..."
                  : "Adding..."
                : isEditing
                  ? "Update Education"
                  : "Add Education"}
            </button>

            {isEditing && (
              <button
                type="button"
                className={
                  styles.cancelButton
                }
                onClick={
                  cancelEditingEducation
                }
                disabled={savingEducation}
              >
                Cancel
              </button>
            )}
          </div>
        </form>
      </section>

      <section
        className={
          styles.actionCard
        }
      >
        <div>
          <h2>
            Ready to check eligibility?
          </h2>

          <p>
            Your latest profile and education
            details will be used to evaluate
            government exam requirements.
          </p>
        </div>

        <button
          type="button"
          className={
            styles.primaryButton
          }
          onClick={goToDashboard}
        >
          Check My Exams →
        </button>
      </section>
    </main>
  );
}