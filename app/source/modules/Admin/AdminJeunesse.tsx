/* eslint-disable react/no-unstable-nested-components */
// AdminJeunesse.tsx  ✅ Multi-question quiz + isActive + add/edit/delete questions

import React, { useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  FlatList,
  ActivityIndicator,
  Modal,
  ScrollView,
  TextInput,
  Platform,
  Alert,
  Pressable,
  Keyboard,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { COLORS } from "../../../core/theme/colors";
import { db } from "../auth/firebaseConfig";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import useAdminEnglish from "../../../../src/hooks/useAdminEnglish";

type Tab = "children" | "concours" | "quiz";

const SETTINGS_DOC = "global"; // doc id inside jeunesse_settings
const PHASES = ["prelim", "preselection", "selection", "final"] as const;
type Phase = (typeof PHASES)[number];

const PHASE_LABEL: Record<Phase, string> = {
  prelim: "Preliminary",
  preselection: "Preselection",
  selection: "Selection",
  final: "Final",
};

function genIdentifier() {
  return (
    "J" +
    Date.now().toString(36).slice(-6).toUpperCase() +
    Math.random().toString(36).slice(2, 6).toUpperCase()
  );
}

function norm(s: any) {
  return String(s || "").trim();
}

function uniqSorted(values: string[]) {
  const set = new Set<string>();
  values
    .map((v) => norm(v))
    .filter(Boolean)
    .forEach((v) => set.add(v));
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

function phaseIndex(p: Phase) {
  return PHASES.indexOf(p);
}

function nextPhase(p: Phase): Phase | null {
  const i = phaseIndex(p);
  if (i < 0 || i >= PHASES.length - 1) return null;
  return PHASES[i + 1];
}

/** ========= Quiz helpers (multi-question) ========= **/
type QuizQuestion = {
  id: string;
  text: string;
  options: string[]; // 4 options
  answerIndex: number; // 0..3
};

function emptyQuestion(): QuizQuestion {
  return {
    id:
      "q_" +
      Date.now().toString(36).slice(-6).toUpperCase() +
      Math.random().toString(36).slice(2, 6).toUpperCase(),
    text: "",
    options: ["", "", "", ""],
    answerIndex: 0,
  };
}

function normalizeOldQuizToMulti(q: any) {
  // Supports old: {question, options:{A..D}, correct:"A"} -> converts to questions:[...]
  const title = norm(q?.title) || "Quiz";
  const durationSec = Number(q?.durationSec || 60);
  const isActive = q?.isActive ?? true;

  if (Array.isArray(q?.questions) && q.questions.length) {
    return {
      title,
      durationSec,
      isActive,
      questions: q.questions as QuizQuestion[],
    };
  }

  const oldQ = norm(q?.question);
  const A = norm(q?.options?.A);
  const B = norm(q?.options?.B);
  const C = norm(q?.options?.C);
  const D = norm(q?.options?.D);
  const opts = [A, B, C, D].filter((x) => x !== "");
  const correct = String(q?.correct || "A").toUpperCase();
  const answerIndex = ["A", "B", "C", "D"].indexOf(correct);

  if (!oldQ || opts.length < 2 || answerIndex < 0) {
    return { title, durationSec, isActive, questions: [] as QuizQuestion[] };
  }

  return {
    title,
    durationSec,
    isActive,
    questions: [
      {
        id: q?.id || "q1",
        text: oldQ,
        options: [A, B, C, D],
        answerIndex,
      },
    ] as QuizQuestion[],
  };
}

export default function AdminJeunesse({ navigation }: any) {
  const { t } = useTranslation();
  useAdminEnglish();

  const [tab, setTab] = useState<Tab>("children");
  const [loading, setLoading] = useState(true);

  // ---------- Children ----------
  const [children, setChildren] = useState<any[]>([]);
  const [qText, setQText] = useState("");

  // Filters (dropdowns with unique values)
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({
    country: "",
    province: "",
    city: "",
    region: "",
    subRegion: "",
  });

  // dropdown picker state (for filters)
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerField, setPickerField] = useState<keyof typeof filters>("country");
  const [pickerOptions, setPickerOptions] = useState<string[]>([]);
  const [pickerTitle, setPickerTitle] = useState("");
  const [pickerSearch, setPickerSearch] = useState("");

  const [childModalOpen, setChildModalOpen] = useState(false);
  const [editingChild, setEditingChild] = useState<any | null>(null);
  const [childDraft, setChildDraft] = useState({
    firstName: "",
    lastName: "",
    age: "",
    currentClass: "",
    academicYear: "",
    parishName: "",
    parishShepherdNames: "",
    mainTeacherNames: "",
    shepherdPhone: "",
    teacherPhone: "",
    contactEmail: "",
    country: "",
    province: "",
    city: "",
    region: "",
    subRegion: "",
    identifier: "",
  });

  // ---------- Concours ----------
  const [settings, setSettings] = useState<any>(null);
  const [concoursOpen, setConcoursOpen] = useState(false);

  // Manage candidates modal (search + click to add)
  const [candidatesOpen, setCandidatesOpen] = useState(false);
  const [candidatePhase, setCandidatePhase] = useState<Phase>("prelim");
  const [candidateSearch, setCandidateSearch] = useState("");
  const [selectedCandidateIds, setSelectedCandidateIds] = useState<string[]>([]);

  // Passed modal (check passed + average mark -> moves to next phase)
  const [passedOpen, setPassedOpen] = useState(false);
  const [passedPhase, setPassedPhase] = useState<Phase>("prelim");
  const [passedSearch, setPassedSearch] = useState("");
  const [passedMap, setPassedMap] = useState<Record<string, { passed: boolean; average: string }>>({});

  // Periods per year
  const [periodDraft, setPeriodDraft] = useState({
    year: String(new Date().getFullYear()),
    prelimStart: "",
    prelimEnd: "",
    preselectionStart: "",
    preselectionEnd: "",
    selectionStart: "",
    selectionEnd: "",
    finalStart: "",
    finalEnd: "",
  });

  // ---------- Quiz (MULTI-QUESTIONS) ----------
  const [quizOpen, setQuizOpen] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState<any | null>(null);

  const [quizDraft, setQuizDraft] = useState<{
    title: string;
    durationSec: string;
    isActive: boolean;
    questions: QuizQuestion[];
  }>({
    title: "",
    durationSec: "60",
    isActive: true,
    questions: [],
  });

  const [questionModal, setQuestionModal] = useState(false);
  const [questionDraft, setQuestionDraft] = useState<QuizQuestion>(emptyQuestion());
  const [editingQuestionIndex, setEditingQuestionIndex] = useState<number | null>(null);

  // ---------- Load ----------
  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        await Promise.all([loadChildren(), loadSettings(), loadActiveQuiz()]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const loadChildren = async () => {
    const snap = await getDocs(query(collection(db, "jeunesse_children"), orderBy("createdAt", "desc")));
    setChildren(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
  };

  const loadSettings = async () => {
    const ref = doc(db, "jeunesse_settings", SETTINGS_DOC);
    const s = await getDoc(ref);
    const data = s.exists() ? s.data() : {};
    setSettings(data || {});

    const year = String(new Date().getFullYear());
    const y = (data?.years || {})[year] || {};
    setPeriodDraft({
      year,
      prelimStart: y?.periods?.prelim?.start || "",
      prelimEnd: y?.periods?.prelim?.end || "",
      preselectionStart: y?.periods?.preselection?.start || "",
      preselectionEnd: y?.periods?.preselection?.end || "",
      selectionStart: y?.periods?.selection?.start || "",
      selectionEnd: y?.periods?.selection?.end || "",
      finalStart: y?.periods?.final?.start || "",
      finalEnd: y?.periods?.final?.end || "",
    });
  };

  const loadActiveQuiz = async () => {
    // Prefer isActive==true newest, else newest overall
    let snap = await getDocs(
      query(collection(db, "jeunesse_quizzes"), where("isActive", "==", true), orderBy("createdAt", "desc"), limit(1))
    );

    if (snap.empty) {
      snap = await getDocs(query(collection(db, "jeunesse_quizzes"), orderBy("createdAt", "desc"), limit(1)));
    }

    if (snap.empty) {
      setActiveQuiz(null);
      return;
    }
    const d = snap.docs[0];
    setActiveQuiz({ id: d.id, ...d.data() });
  };

  // ---------- Filters + Search ----------
  const filteredChildren = useMemo(() => {
    const text = qText.trim().toLowerCase();
    let list = [...children];
    const f = filters;

    if (norm(f.country)) list = list.filter((c) => norm(c.country).toLowerCase() === norm(f.country).toLowerCase());
    if (norm(f.province)) list = list.filter((c) => norm(c.province).toLowerCase() === norm(f.province).toLowerCase());
    if (norm(f.city)) list = list.filter((c) => norm(c.city).toLowerCase() === norm(f.city).toLowerCase());
    if (norm(f.region)) list = list.filter((c) => norm(c.region).toLowerCase() === norm(f.region).toLowerCase());
    if (norm(f.subRegion)) list = list.filter((c) => norm(c.subRegion).toLowerCase() === norm(f.subRegion).toLowerCase());

    if (text) {
      list = list.filter((c) => {
        const full = `${norm(c.firstName)} ${norm(c.lastName)}`.toLowerCase();
        const id = norm(c.identifier).toLowerCase();
        const parish = norm(c.parishName).toLowerCase();
        return full.includes(text) || id.includes(text) || parish.includes(text);
      });
    }

    return list;
  }, [children, qText, filters]);

  // ---------- Unique dropdown values (deduplicated) ----------
  const uniqueCountries = useMemo(() => uniqSorted(children.map((c) => c.country)), [children]);

  const uniqueProvinces = useMemo(() => {
    const base = children.filter((c) => !norm(filters.country) || norm(c.country).toLowerCase() === norm(filters.country).toLowerCase());
    return uniqSorted(base.map((c) => c.province));
  }, [children, filters.country]);

  const uniqueCities = useMemo(() => {
    const base = children.filter((c) => {
      const okCountry = !norm(filters.country) || norm(c.country).toLowerCase() === norm(filters.country).toLowerCase();
      const okProv = !norm(filters.province) || norm(c.province).toLowerCase() === norm(filters.province).toLowerCase();
      return okCountry && okProv;
    });
    return uniqSorted(base.map((c) => c.city));
  }, [children, filters.country, filters.province]);

  const uniqueRegions = useMemo(() => {
    const base = children.filter((c) => {
      const okCountry = !norm(filters.country) || norm(c.country).toLowerCase() === norm(filters.country).toLowerCase();
      const okProv = !norm(filters.province) || norm(c.province).toLowerCase() === norm(filters.province).toLowerCase();
      const okCity = !norm(filters.city) || norm(c.city).toLowerCase() === norm(filters.city).toLowerCase();
      return okCountry && okProv && okCity;
    });
    return uniqSorted(base.map((c) => c.region));
  }, [children, filters.country, filters.province, filters.city]);

  const uniqueSubRegions = useMemo(() => {
    const base = children.filter((c) => {
      const okCountry = !norm(filters.country) || norm(c.country).toLowerCase() === norm(filters.country).toLowerCase();
      const okProv = !norm(filters.province) || norm(c.province).toLowerCase() === norm(filters.province).toLowerCase();
      const okCity = !norm(filters.city) || norm(c.city).toLowerCase() === norm(filters.city).toLowerCase();
      const okRegion = !norm(filters.region) || norm(c.region).toLowerCase() === norm(filters.region).toLowerCase();
      return okCountry && okProv && okCity && okRegion;
    });
    return uniqSorted(base.map((c) => c.subRegion));
  }, [children, filters.country, filters.province, filters.city, filters.region]);

  const openPicker = (field: keyof typeof filters) => {
    Keyboard.dismiss();
    setPickerSearch("");
    setPickerField(field);

    const titleMap: Record<string, string> = {
      country: t("adminJeunesse.children.country"),
      province: t("adminJeunesse.children.province"),
      city: t("adminJeunesse.children.city"),
      region: t("adminJeunesse.children.region"),
      subRegion: t("adminJeunesse.children.subRegion"),
    };

    const optionsMap: Record<string, string[]> = {
      country: uniqueCountries,
      province: uniqueProvinces,
      city: uniqueCities,
      region: uniqueRegions,
      subRegion: uniqueSubRegions,
    };

    setPickerTitle(titleMap[field]);
    setPickerOptions(optionsMap[field] || []);
    setPickerOpen(true);
  };

  const applyPickedValue = (value: string) => {
    setFilters((s) => {
      if (pickerField === "country") return { country: value, province: "", city: "", region: "", subRegion: "" };
      if (pickerField === "province") return { ...s, province: value, city: "", region: "", subRegion: "" };
      if (pickerField === "city") return { ...s, city: value, region: "", subRegion: "" };
      if (pickerField === "region") return { ...s, region: value, subRegion: "" };
      return { ...s, subRegion: value };
    });
    setPickerOpen(false);
  };

  // ---------- Child modals ----------
  const openAddChild = () => {
    setEditingChild(null);
    setChildDraft({
      firstName: "",
      lastName: "",
      age: "",
      currentClass: "",
      academicYear: "",
      parishName: "",
      parishShepherdNames: "",
      mainTeacherNames: "",
      shepherdPhone: "",
      teacherPhone: "",
      contactEmail: "",
      country: "",
      province: "",
      city: "",
      region: "",
      subRegion: "",
      identifier: genIdentifier(),
    });
    setChildModalOpen(true);
  };

  const openEditChild = (c: any) => {
    setEditingChild(c);
    setChildDraft({
      firstName: norm(c.firstName),
      lastName: norm(c.lastName),
      age: String(c.age || ""),
      currentClass: norm(c.currentClass),
      academicYear: norm(c.academicYear),
      parishName: norm(c.parishName),
      parishShepherdNames: norm(c.parishShepherdNames),
      mainTeacherNames: norm(c.mainTeacherNames),
      shepherdPhone: norm(c.shepherdPhone),
      teacherPhone: norm(c.teacherPhone),
      contactEmail: norm(c.contactEmail),
      country: norm(c.country),
      province: norm(c.province),
      city: norm(c.city),
      region: norm(c.region),
      subRegion: norm(c.subRegion),
      identifier: norm(c.identifier) || genIdentifier(),
    });
    setChildModalOpen(true);
  };

  const saveChild = async () => {
    if (!childDraft.firstName.trim() || !childDraft.lastName.trim() || !childDraft.identifier.trim()) {
      Alert.alert(t("adminJeunesse.title"), t("adminJeunesse.children.required"));
      return;
    }

    try {
      const payload = {
        ...childDraft,
        age: Number(childDraft.age || 0),
        updatedAt: serverTimestamp(),
      };

      if (editingChild) {
        await updateDoc(doc(db, "jeunesse_children", editingChild.id), payload);
      } else {
        await addDoc(collection(db, "jeunesse_children"), {
          ...payload,
          createdAt: serverTimestamp(),
        });
      }

      setChildModalOpen(false);
      await loadChildren();
    } catch (e: any) {
      Alert.alert(t("adminJeunesse.title"), e?.message || "Error");
    }
  };

  const deleteChild = async (c: any) => {
    Alert.alert(t("adminJeunesse.title"), t("common.delete") + "?", [
      { text: t("common.cancel") },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: async () => {
          try {
            await deleteDoc(doc(db, "jeunesse_children", c.id));
            await loadChildren();
          } catch (e: any) {
            Alert.alert(t("adminJeunesse.title"), e?.message || "Error");
          }
        },
      },
    ]);
  };

  // ---------- Concours settings ----------
  const openConcours = () => setConcoursOpen(true);

  const savePeriods = async () => {
    try {
      const ref = doc(db, "jeunesse_settings", SETTINGS_DOC);
      const year = periodDraft.year.trim() || String(new Date().getFullYear());

      const currentYears = settings?.years || {};
      const currentYear = currentYears[year] || {};
      const currentConcours = currentYear?.concours || {
        prelim: { candidates: [], passed: {} },
        preselection: { candidates: [], passed: {} },
        selection: { candidates: [], passed: {} },
        final: { candidates: [], passed: {} },
      };

      const next = {
        years: {
          ...currentYears,
          [year]: {
            ...currentYear,
            periods: {
              prelim: { start: periodDraft.prelimStart.trim(), end: periodDraft.prelimEnd.trim() },
              preselection: { start: periodDraft.preselectionStart.trim(), end: periodDraft.preselectionEnd.trim() },
              selection: { start: periodDraft.selectionStart.trim(), end: periodDraft.selectionEnd.trim() },
              final: { start: periodDraft.finalStart.trim(), end: periodDraft.finalEnd.trim() },
            },
            concours: currentConcours,
          },
        },
        updatedAt: serverTimestamp(),
      };

      await setDoc(ref, next, { merge: true });
      setConcoursOpen(false);
      await loadSettings();
      Alert.alert(t("adminJeunesse.title"), t("adminJeunesse.concours.saved"));
    } catch (e: any) {
      Alert.alert(t("adminJeunesse.title"), e?.message || "Error");
    }
  };

  // ====== Candidates workflow ======
  const getYearData = () => {
    const year = periodDraft.year.trim() || String(new Date().getFullYear());
    const y = (settings?.years || {})[year] || {};
    const concours = y?.concours || {
      prelim: { candidates: [], passed: {} },
      preselection: { candidates: [], passed: {} },
      selection: { candidates: [], passed: {} },
      final: { candidates: [], passed: {} },
    };
    return { year, y, concours };
  };

  const openCandidates = (phase: Phase) => {
    Keyboard.dismiss();
    const { concours } = getYearData();
    const ids: string[] = (concours?.[phase]?.candidates || []) as string[];
    setCandidatePhase(phase);
    setCandidateSearch("");
    setSelectedCandidateIds(ids);
    setCandidatesOpen(true);
  };

  const saveCandidates = async () => {
    try {
      const { year, y, concours } = getYearData();
      const ref = doc(db, "jeunesse_settings", SETTINGS_DOC);

      const next = {
        years: {
          ...(settings?.years || {}),
          [year]: {
            ...y,
            concours: {
              ...concours,
              [candidatePhase]: {
                ...concours[candidatePhase],
                candidates: selectedCandidateIds,
              },
            },
          },
        },
        updatedAt: serverTimestamp(),
      };

      await setDoc(ref, next, { merge: true });
      setCandidatesOpen(false);
      await loadSettings();
      Alert.alert(t("adminJeunesse.title"), t("adminJeunesse.concours.saved"));
    } catch (e: any) {
      Alert.alert(t("adminJeunesse.title"), e?.message || "Error");
    }
  };

  const selectedCandidateSet = useMemo(() => new Set(selectedCandidateIds), [selectedCandidateIds]);

  const candidatePool = useMemo(() => {
    const list = filteredChildren;
    const text = candidateSearch.trim().toLowerCase();
    if (!text) return list;

    return list.filter((c) => {
      const full = `${norm(c.firstName)} ${norm(c.lastName)}`.toLowerCase();
      const id = norm(c.identifier).toLowerCase();
      const parish = norm(c.parishName).toLowerCase();
      return full.includes(text) || id.includes(text) || parish.includes(text);
    });
  }, [filteredChildren, candidateSearch]);

  const addCandidate = (childId: string) => {
    if (selectedCandidateSet.has(childId)) return;
    setSelectedCandidateIds((prev) => [childId, ...prev]);
  };

  const removeCandidate = (childId: string) => {
    setSelectedCandidateIds((prev) => prev.filter((id) => id !== childId));
  };

  const selectedCandidateObjects = useMemo(() => {
    const map = new Map(children.map((c) => [c.id, c]));
    return selectedCandidateIds.map((id) => map.get(id)).filter(Boolean);
  }, [children, selectedCandidateIds]);

  // ====== Passed workflow ======
  const openPassed = (phase: Phase) => {
    Keyboard.dismiss();
    const { concours } = getYearData();
    const ids: string[] = (concours?.[phase]?.candidates || []) as string[];

    const existingPassed = (concours?.[phase]?.passed || {}) as Record<string, any>;

    const init: Record<string, { passed: boolean; average: string }> = {};
    ids.forEach((id) => {
      const p = existingPassed[id];
      init[id] = {
        passed: !!p?.passed,
        average: p?.average != null ? String(p.average) : "",
      };
    });

    setPassedPhase(phase);
    setPassedSearch("");
    setPassedMap(init);
    setPassedOpen(true);
  };

  const togglePassed = (childId: string) => {
    setPassedMap((m) => ({
      ...m,
      [childId]: { passed: !m?.[childId]?.passed, average: m?.[childId]?.average ?? "" },
    }));
  };

  const setAverage = (childId: string, v: string) => {
    const cleaned = v.replace(/[^\d.]/g, "");
    setPassedMap((m) => ({
      ...m,
      [childId]: { passed: m?.[childId]?.passed ?? false, average: cleaned },
    }));
  };

  const passedList = useMemo(() => {
    const { concours } = getYearData();
    const ids: string[] = (concours?.[passedPhase]?.candidates || []) as string[];

    const map = new Map(children.map((c) => [c.id, c]));
    let list = ids.map((id) => map.get(id)).filter(Boolean) as any[];

    const text = passedSearch.trim().toLowerCase();
    if (text) {
      list = list.filter((c) => {
        const full = `${norm(c.firstName)} ${norm(c.lastName)}`.toLowerCase();
        const id = norm(c.identifier).toLowerCase();
        return full.includes(text) || id.includes(text);
      });
    }
    return list;
  }, [children, settings, periodDraft.year, passedPhase, passedSearch]);

  const savePassedAndMoveNext = async () => {
    try {
      const { year, y, concours } = getYearData();
      const ref = doc(db, "jeunesse_settings", SETTINGS_DOC);

      const from = passedPhase;
      const to = nextPhase(from);

      if (!to) {
        Alert.alert(t("adminJeunesse.title"), "This is the final phase. No next concours to move to.");
        return;
      }

      const fromCandidates: string[] = (concours?.[from]?.candidates || []) as string[];
      const toCandidatesSet = new Set<string>((concours?.[to]?.candidates || []) as string[]);

      const nextFromPassed: Record<string, any> = { ...(concours?.[from]?.passed || {}) };
      const toAdd: string[] = [];

      for (const id of fromCandidates) {
        const entry = passedMap[id];
        if (!entry) continue;

        nextFromPassed[id] = {
          passed: !!entry.passed,
          average: entry.average ? Number(entry.average) : null,
          updatedAt: Date.now(),
        };

        if (entry.passed) {
          if (!toCandidatesSet.has(id)) {
            toCandidatesSet.add(id);
            toAdd.push(id);
          }

          const child = children.find((c) => c.id === id);
          if (child?.identifier) {
            const resultId = `${year}_${to}_${id}`;
            await setDoc(
              doc(db, "jeunesse_results", resultId),
              {
                year,
                phase: to,
                childId: id,
                identifier: norm(child.identifier),
                fullName: `${norm(child.firstName)} ${norm(child.lastName)}`.trim(),
                country: norm(child.country),
                province: norm(child.province),
                city: norm(child.city),
                average: entry.average ? Number(entry.average) : null,
                movedFrom: from,
                updatedAt: serverTimestamp(),
              },
              { merge: true }
            );
          }
        }
      }

      const next = {
        years: {
          ...(settings?.years || {}),
          [year]: {
            ...y,
            concours: {
              ...concours,
              [from]: {
                ...concours[from],
                passed: nextFromPassed,
              },
              [to]: {
                ...concours[to],
                candidates: Array.from(toCandidatesSet),
              },
            },
          },
        },
        updatedAt: serverTimestamp(),
      };

      await setDoc(ref, next, { merge: true });

      setPassedOpen(false);
      await loadSettings();

      Alert.alert(t("adminJeunesse.title"), `Saved. Moved ${toAdd.length} candidate(s) to ${PHASE_LABEL[to]}.`);
    } catch (e: any) {
      Alert.alert(t("adminJeunesse.title"), e?.message || "Error");
    }
  };

  // ---------- Quiz (MULTI-QUESTIONS) ----------
  const openQuiz = () => {
    const q = activeQuiz || {};
    const multi = normalizeOldQuizToMulti(q);

    setQuizDraft({
      title: multi.title || "",
      durationSec: String(multi.durationSec || 60),
      isActive: !!multi.isActive,
      questions: multi.questions || [],
    });

    setQuizOpen(true);
  };

  const openAddQuestion = () => {
    setQuestionDraft(emptyQuestion());
    setEditingQuestionIndex(null);
    setQuestionModal(true);
  };

  const openEditQuestion = (q: QuizQuestion, index: number) => {
    setQuestionDraft({
      id: q.id,
      text: norm(q.text),
      options: Array.isArray(q.options) ? [...q.options] : ["", "", "", ""],
      answerIndex: Number.isFinite(q.answerIndex) ? q.answerIndex : 0,
    });
    setEditingQuestionIndex(index);
    setQuestionModal(true);
  };

  const saveQuestion = () => {
    if (!questionDraft.text.trim()) {
      Alert.alert(t("adminJeunesse.title"), "Question text required");
      return;
    }
    const opts = (questionDraft.options || []).map((x) => norm(x));
    if (opts.filter(Boolean).length < 2) {
      Alert.alert(t("adminJeunesse.title"), "Provide at least 2 options");
      return;
    }
    const idx = Number(questionDraft.answerIndex || 0);
    if (idx < 0 || idx > 3) {
      Alert.alert(t("adminJeunesse.title"), "Correct answer index must be 0 - 3");
      return;
    }

    const list = [...(quizDraft.questions || [])];
    const cleaned: QuizQuestion = {
      id: questionDraft.id || emptyQuestion().id,
      text: questionDraft.text.trim(),
      options: [opts[0] || "", opts[1] || "", opts[2] || "", opts[3] || ""],
      answerIndex: idx,
    };

    if (editingQuestionIndex !== null) {
      list[editingQuestionIndex] = cleaned;
    } else {
      list.push(cleaned);
    }

    setQuizDraft((s) => ({ ...s, questions: list }));
    setQuestionModal(false);
  };

  const deleteQuestion = (index: number) => {
    Alert.alert(t("adminJeunesse.title"), "Delete this question?", [
      { text: t("common.cancel") },
      {
        text: t("common.delete"),
        style: "destructive",
        onPress: () => {
          const list = [...(quizDraft.questions || [])];
          list.splice(index, 1);
          setQuizDraft((s) => ({ ...s, questions: list }));
        },
      },
    ]);
  };

  const saveQuiz = async () => {
    if (!quizDraft.title.trim()) {
      Alert.alert(t("adminJeunesse.title"), "Quiz title required");
      return;
    }
    if (!quizDraft.questions.length) {
      Alert.alert(t("adminJeunesse.title"), "Add at least one question");
      return;
    }

    try {
      // if you set this quiz active, deactivate others
      if (quizDraft.isActive) {
        const snap = await getDocs(query(collection(db, "jeunesse_quizzes"), where("isActive", "==", true)));
        for (const d of snap.docs) {
          if (d.id !== activeQuiz?.id) {
            await updateDoc(doc(db, "jeunesse_quizzes", d.id), { isActive: false, updatedAt: serverTimestamp() });
          }
        }
      }

      const payload = {
        title: quizDraft.title.trim(),
        durationSec: Number(quizDraft.durationSec || 60),
        isActive: !!quizDraft.isActive,
        questions: quizDraft.questions,
        updatedAt: serverTimestamp(),
      };

      if (activeQuiz?.id) {
        await updateDoc(doc(db, "jeunesse_quizzes", activeQuiz.id), payload);
      } else {
        await addDoc(collection(db, "jeunesse_quizzes"), { ...payload, createdAt: serverTimestamp() });
      }

      setQuizOpen(false);
      await loadActiveQuiz();
      Alert.alert(t("adminJeunesse.title"), t("adminJeunesse.quiz.saved"));
    } catch (e: any) {
      Alert.alert(t("adminJeunesse.title"), e?.message || "Error");
    }
  };

  // ---------- UI helpers ----------
  const HeroSubtitle = () => {
    const total = children.length;
    if (tab === "children") return `${t("adminJeunesse.children.total")}: ${total}`;
    if (tab === "concours") return "Set periods, candidates, and move passed candidates to next concours";
    return t("adminJeunesse.subtitle");
  };

  const renderChild = ({ item }: any) => {
    return (
      <TouchableOpacity style={styles.card} activeOpacity={0.92} onPress={() => openEditChild(item)}>
        <View style={styles.cardLeft}>
          <View style={styles.avatarFallback}>
            <Icon name="school-outline" size={20} color={COLORS.light.primary} />
          </View>
        </View>

        <View style={{ flex: 1 }}>
          <View style={styles.rowBetween}>
            <Text style={styles.name} numberOfLines={1}>
              {item.firstName} {item.lastName}
            </Text>

            <View style={[styles.badgePill, { backgroundColor: "rgba(47,165,169,0.12)" }]}>
              <Text style={[styles.badgeText, { color: "#0F766E" }]} numberOfLines={1}>
                {t("adminJeunesse.children.id")}: {item.identifier || "—"}
              </Text>
            </View>
          </View>

          <Text style={styles.email} numberOfLines={1}>
            {t("adminJeunesse.children.parish")}: {item.parishName || "—"}
          </Text>

          <View style={styles.metaRow}>
            <Text style={styles.metaText} numberOfLines={1}>
              {t("adminJeunesse.children.age")}: {item.age || "—"} · {t("adminJeunesse.children.class")}:{" "}
              {item.currentClass || "—"}
            </Text>
          </View>

          <View style={styles.metaRow}>
            <Text style={styles.metaText} numberOfLines={1}>
              {t("adminJeunesse.children.country")}: {item.country || "—"} · {t("adminJeunesse.children.city")}:{" "}
              {item.city || "—"}
            </Text>
          </View>
        </View>

        <TouchableOpacity onPress={() => deleteChild(item)} style={styles.trashBtn} activeOpacity={0.9}>
          <Icon name="trash-outline" size={18} color="#111" />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  const ConcoursCard = () => {
    const { concours } = getYearData();
    const phaseCount = (p: Phase) => ((concours?.[p]?.candidates || []) as string[]).length;

    return (
      <View style={styles.sectionCard}>
        <Text style={styles.sectionTitle}>Concours</Text>

        <Text style={styles.helperText}>
          Year: {periodDraft.year} · Use “Candidates” to select participants, then “Passed → Next” to move them forward.
        </Text>

        <View style={{ height: 12 }} />

        {PHASES.map((p) => (
          <View key={p} style={styles.concoursBox}>
            <View style={{ flex: 1 }}>
              <Text style={styles.roomName}>{PHASE_LABEL[p]}</Text>
              <Text style={styles.roomSub}>
                Candidates: {phaseCount(p)} · Period:{" "}
                {p === "prelim"
                  ? `${periodDraft.prelimStart || "—"} → ${periodDraft.prelimEnd || "—"}`
                  : p === "preselection"
                  ? `${periodDraft.preselectionStart || "—"} → ${periodDraft.preselectionEnd || "—"}`
                  : p === "selection"
                  ? `${periodDraft.selectionStart || "—"} → ${periodDraft.selectionEnd || "—"}`
                  : `${periodDraft.finalStart || "—"} → ${periodDraft.finalEnd || "—"}`}
              </Text>
            </View>

            <View style={{ flexDirection: "row", gap: 10 }}>
              <TouchableOpacity onPress={() => openCandidates(p)} style={styles.smallIconBtn} activeOpacity={0.9}>
                <Icon name="people-outline" size={18} color="#111" />
              </TouchableOpacity>

              <TouchableOpacity onPress={() => openPassed(p)} style={styles.smallIconBtn} activeOpacity={0.9}>
                <Icon name="checkmark-done-outline" size={18} color="#111" />
              </TouchableOpacity>
            </View>
          </View>
        ))}

        <TouchableOpacity style={[styles.primaryBtn, { marginTop: 14 }]} onPress={openConcours}>
          <Icon name="calendar-outline" size={16} color="#fff" />
          <Text style={styles.primaryText}>Set Periods</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <View style={styles.screen}>
      {/* HERO */}
      <View style={styles.hero}>
        <View style={styles.heroTop}>
          <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
            <Icon name="chevron-back" size={22} color="#fff" />
          </TouchableOpacity>

          <View style={{ flex: 1 }}>
            <Text style={styles.heroTitle}>{t("adminJeunesse.title")}</Text>
            <Text style={styles.heroSub} numberOfLines={1}>
              {HeroSubtitle()}
            </Text>
          </View>

          {tab === "children" ? (
            <TouchableOpacity onPress={openAddChild} style={styles.heroAction} activeOpacity={0.9}>
              <Icon name="add" size={20} color="#111" />
            </TouchableOpacity>
          ) : tab === "concours" ? (
            <TouchableOpacity onPress={openConcours} style={styles.heroAction} activeOpacity={0.9}>
              <Icon name="calendar-outline" size={20} color="#111" />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity onPress={openQuiz} style={styles.heroAction} activeOpacity={0.9}>
              <Icon name="help-circle-outline" size={20} color="#111" />
            </TouchableOpacity>
          )}
        </View>

        {/* Search (for children tab) */}
        {tab === "children" ? (
          <View style={styles.searchRow}>
            <Icon name="search" size={16} color="rgba(255,255,255,0.75)" />
            <TextInput
              value={qText}
              onChangeText={setQText}
              placeholder={`${t("common.search")}…`}
              placeholderTextColor="rgba(255,255,255,0.55)"
              style={styles.searchInput}
            />
            <TouchableOpacity onPress={() => setFiltersOpen(true)} style={styles.filterBtn} activeOpacity={0.9}>
              <Icon name="options-outline" size={18} color="#fff" />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Tabs */}
        <View style={styles.pills}>
          <Pill label={t("adminJeunesse.tabs.children")} active={tab === "children"} onPress={() => setTab("children")} />
          <Pill label={t("adminJeunesse.tabs.concours")} active={tab === "concours"} onPress={() => setTab("concours")} />
          <Pill label={t("adminJeunesse.tabs.quiz")} active={tab === "quiz"} onPress={() => setTab("quiz")} />
        </View>
      </View>

      {/* BODY */}
      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator size="large" color={COLORS.light.primary} />
        </View>
      ) : tab === "children" ? (
        <FlatList
          data={filteredChildren}
          keyExtractor={(it) => it.id}
          renderItem={renderChild}
          contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.empty}>
              <Icon name="school-outline" size={54} color="#C7C7CC" />
              <Text style={styles.emptyTitle}>{t("adminJeunesse.children.emptyTitle")}</Text>
              <Text style={styles.emptySub}>{t("adminJeunesse.children.emptySub")}</Text>
            </View>
          }
        />
      ) : tab === "concours" ? (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
          <ConcoursCard />
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 30 }} showsVerticalScrollIndicator={false}>
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{t("adminJeunesse.quiz.title")}</Text>

            {!activeQuiz ? (
              <View style={styles.emptyMini}>
                <Icon name="help-circle-outline" size={44} color="#C7C7CC" />
                <Text style={styles.emptyTitle}>{t("adminJeunesse.quiz.emptyTitle")}</Text>
                <Text style={styles.emptySub}>{t("adminJeunesse.quiz.emptySub")}</Text>
              </View>
            ) : (
              <View style={{ gap: 10 }}>
                <View style={styles.roomRow}>
                  <View style={styles.roomIcon}>
                    <Icon name="help-outline" size={18} color="#111" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.roomName} numberOfLines={2}>
                      {activeQuiz.title || "Quiz"}
                    </Text>
                    <Text style={styles.roomSub} numberOfLines={2}>
                      Questions: {Array.isArray(activeQuiz.questions) ? activeQuiz.questions.length : 1} · Duration:{" "}
                      {activeQuiz.durationSec || 60}s · Active: {activeQuiz.isActive ? "YES" : "NO"}
                    </Text>
                  </View>
                </View>
              </View>
            )}

            <TouchableOpacity style={[styles.primaryBtn, { marginTop: 14 }]} onPress={openQuiz}>
              <Icon name="create-outline" size={16} color="#fff" />
              <Text style={styles.primaryText}>{t("adminJeunesse.quiz.manage")}</Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      )}

      {/* ================= FILTERS MODAL ================= */}
      <Modal visible={filtersOpen} transparent animationType="slide" onRequestClose={() => setFiltersOpen(false)}>
        <View style={styles.overlay}>
          <Pressable style={{ flex: 1 }} onPress={() => (Keyboard.dismiss(), setFiltersOpen(false))} />
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{t("common.filter")}</Text>
                <Text style={styles.modalSub}>Pick from existing values (deduplicated)</Text>
              </View>
              <TouchableOpacity onPress={() => setFiltersOpen(false)} style={styles.modalCloseBtn}>
                <Icon name="close" size={18} color="#111" />
              </TouchableOpacity>
            </View>

            <DropdownField label={t("adminJeunesse.children.country")} value={filters.country} onPress={() => openPicker("country")} />
            <DropdownField label={t("adminJeunesse.children.province")} value={filters.province} onPress={() => openPicker("province")} />
            <DropdownField label={t("adminJeunesse.children.city")} value={filters.city} onPress={() => openPicker("city")} />
            <DropdownField label={t("adminJeunesse.children.region")} value={filters.region} onPress={() => openPicker("region")} />
            <DropdownField label={t("adminJeunesse.children.subRegion")} value={filters.subRegion} onPress={() => openPicker("subRegion")} />

            <View style={styles.twoBtns}>
              <TouchableOpacity
                style={[styles.grayBtn, { flex: 1 }]}
                onPress={() => setFilters({ country: "", province: "", city: "", region: "", subRegion: "" })}
              >
                <Text style={styles.grayBtnText}>{t("common.reset")}</Text>
              </TouchableOpacity>

              <TouchableOpacity style={[styles.primaryBtn, { flex: 1 }]} onPress={() => setFiltersOpen(false)}>
                <Text style={styles.primaryText}>{t("common.apply")}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* ================= FILTER VALUE PICKER MODAL ================= */}
      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <View style={styles.overlayCenter}>
          <Pressable style={{ flex: 1 }} onPress={() => setPickerOpen(false)} />
          <View style={styles.pickerBox}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{pickerTitle}</Text>
                <Text style={styles.modalSub}>Choose one value</Text>
              </View>
              <TouchableOpacity onPress={() => setPickerOpen(false)} style={styles.modalCloseBtn}>
                <Icon name="close" size={18} color="#111" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchRowLight}>
              <Icon name="search" size={16} color="#6B6B70" />
              <TextInput
                value={pickerSearch}
                onChangeText={setPickerSearch}
                placeholder="Search…"
                placeholderTextColor="#9CA3AF"
                style={styles.searchInputDark}
              />
            </View>

            <ScrollView style={{ maxHeight: 320 }} keyboardShouldPersistTaps="handled">
              <TouchableOpacity style={styles.pickItem} onPress={() => applyPickedValue("")} activeOpacity={0.9}>
                <Text style={[styles.pickText, { fontWeight: "900" }]}>— Clear —</Text>
              </TouchableOpacity>

              {pickerOptions
                .filter((o) => !pickerSearch.trim() || o.toLowerCase().includes(pickerSearch.trim().toLowerCase()))
                .map((opt) => (
                  <TouchableOpacity key={opt} style={styles.pickItem} onPress={() => applyPickedValue(opt)} activeOpacity={0.9}>
                    <Text style={styles.pickText}>{opt}</Text>
                  </TouchableOpacity>
                ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ================= CHILD ADD/EDIT MODAL ================= */}
      <Modal visible={childModalOpen} transparent animationType="slide" onRequestClose={() => setChildModalOpen(false)}>
        <View style={styles.overlay}>
          <Pressable style={{ flex: 1 }} onPress={() => (Keyboard.dismiss(), setChildModalOpen(false))} />
          <View style={styles.modal}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>
                    {editingChild ? t("common.edit") : t("common.create")} · {t("adminJeunesse.children.addChild")}
                  </Text>
                  <Text style={styles.modalSub}>{t("adminJeunesse.children.identifierHelp")}</Text>
                </View>
                <TouchableOpacity onPress={() => setChildModalOpen(false)} style={styles.modalCloseBtn}>
                  <Icon name="close" size={18} color="#111" />
                </TouchableOpacity>
              </View>

              <View style={styles.badgeLine}>
                <View style={[styles.badgePill, { backgroundColor: "rgba(47,165,169,0.12)" }]}>
                  <Text style={[styles.badgeText, { color: "#0F766E" }]}>
                    {t("adminJeunesse.children.id")}: {childDraft.identifier || "—"}
                  </Text>
                </View>
                <TouchableOpacity onPress={() => setChildDraft((s) => ({ ...s, identifier: genIdentifier() }))} style={styles.smallBtn}>
                  <Icon name="refresh" size={16} color="#111" />
                  <Text style={styles.smallBtnText}>{t("adminJeunesse.children.generateId")}</Text>
                </TouchableOpacity>
              </View>

              <Field label={t("adminJeunesse.children.firstName")} value={childDraft.firstName} onChangeText={(v) => setChildDraft((s) => ({ ...s, firstName: v }))} />
              <Field label={t("adminJeunesse.children.lastName")} value={childDraft.lastName} onChangeText={(v) => setChildDraft((s) => ({ ...s, lastName: v }))} />
              <Field label={t("adminJeunesse.children.age")} value={childDraft.age} onChangeText={(v) => setChildDraft((s) => ({ ...s, age: v }))} placeholder="e.g. 10" keyboardType="numeric" />
              <Field label={t("adminJeunesse.children.class")} value={childDraft.currentClass} onChangeText={(v) => setChildDraft((s) => ({ ...s, currentClass: v }))} />
              <Field label={t("adminJeunesse.children.academicYear")} value={childDraft.academicYear} onChangeText={(v) => setChildDraft((s) => ({ ...s, academicYear: v }))} placeholder="2024-2025" />

              <View style={styles.divider} />

              <Field label={t("adminJeunesse.children.parish")} value={childDraft.parishName} onChangeText={(v) => setChildDraft((s) => ({ ...s, parishName: v }))} />
              <Field label={t("adminJeunesse.children.shepherd")} value={childDraft.parishShepherdNames} onChangeText={(v) => setChildDraft((s) => ({ ...s, parishShepherdNames: v }))} />
              <Field label={t("adminJeunesse.children.teacher")} value={childDraft.mainTeacherNames} onChangeText={(v) => setChildDraft((s) => ({ ...s, mainTeacherNames: v }))} />
              <Field label={`${t("adminJeunesse.children.phones")} (shepherd)`} value={childDraft.shepherdPhone} onChangeText={(v) => setChildDraft((s) => ({ ...s, shepherdPhone: v }))} />
              <Field label={`${t("adminJeunesse.children.phones")} (teacher)`} value={childDraft.teacherPhone} onChangeText={(v) => setChildDraft((s) => ({ ...s, teacherPhone: v }))} />
              <Field label={t("adminJeunesse.children.email")} value={childDraft.contactEmail} onChangeText={(v) => setChildDraft((s) => ({ ...s, contactEmail: v }))} />

              <View style={styles.divider} />

              <Field label={t("adminJeunesse.children.country")} value={childDraft.country} onChangeText={(v) => setChildDraft((s) => ({ ...s, country: v }))} />
              <Field label={t("adminJeunesse.children.province")} value={childDraft.province} onChangeText={(v) => setChildDraft((s) => ({ ...s, province: v }))} />
              <Field label={t("adminJeunesse.children.city")} value={childDraft.city} onChangeText={(v) => setChildDraft((s) => ({ ...s, city: v }))} />
              <Field label={t("adminJeunesse.children.region")} value={childDraft.region} onChangeText={(v) => setChildDraft((s) => ({ ...s, region: v }))} />
              <Field label={t("adminJeunesse.children.subRegion")} value={childDraft.subRegion} onChangeText={(v) => setChildDraft((s) => ({ ...s, subRegion: v }))} />

              <TouchableOpacity style={styles.primaryBtn} onPress={saveChild}>
                <Icon name="save-outline" size={16} color="#fff" />
                <Text style={styles.primaryText}>{t("common.save")}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ================= CONCOURS PERIOD MODAL ================= */}
      <Modal visible={concoursOpen} transparent animationType="slide" onRequestClose={() => setConcoursOpen(false)}>
        <View style={styles.overlay}>
          <Pressable style={{ flex: 1 }} onPress={() => (Keyboard.dismiss(), setConcoursOpen(false))} />
          <View style={styles.modal}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>Set Periods</Text>
                  <Text style={styles.modalSub}>{t("adminJeunesse.concours.periodsHelp")}</Text>
                </View>
                <TouchableOpacity onPress={() => setConcoursOpen(false)} style={styles.modalCloseBtn}>
                  <Icon name="close" size={18} color="#111" />
                </TouchableOpacity>
              </View>

              <Field label={t("adminJeunesse.concours.year")} value={periodDraft.year} onChangeText={(v) => setPeriodDraft((s) => ({ ...s, year: v }))} placeholder="2026" />

              <Text style={styles.sectionTitle}>Preliminary</Text>
              <Field label={t("adminJeunesse.concours.start")} value={periodDraft.prelimStart} onChangeText={(v) => setPeriodDraft((s) => ({ ...s, prelimStart: v }))} />
              <Field label={t("adminJeunesse.concours.end")} value={periodDraft.prelimEnd} onChangeText={(v) => setPeriodDraft((s) => ({ ...s, prelimEnd: v }))} />

              <Text style={styles.sectionTitle}>Preselection</Text>
              <Field label={t("adminJeunesse.concours.start")} value={periodDraft.preselectionStart} onChangeText={(v) => setPeriodDraft((s) => ({ ...s, preselectionStart: v }))} />
              <Field label={t("adminJeunesse.concours.end")} value={periodDraft.preselectionEnd} onChangeText={(v) => setPeriodDraft((s) => ({ ...s, preselectionEnd: v }))} />

              <Text style={styles.sectionTitle}>Selection</Text>
              <Field label={t("adminJeunesse.concours.start")} value={periodDraft.selectionStart} onChangeText={(v) => setPeriodDraft((s) => ({ ...s, selectionStart: v }))} />
              <Field label={t("adminJeunesse.concours.end")} value={periodDraft.selectionEnd} onChangeText={(v) => setPeriodDraft((s) => ({ ...s, selectionEnd: v }))} />

              <Text style={styles.sectionTitle}>Final</Text>
              <Field label={t("adminJeunesse.concours.start")} value={periodDraft.finalStart} onChangeText={(v) => setPeriodDraft((s) => ({ ...s, finalStart: v }))} />
              <Field label={t("adminJeunesse.concours.end")} value={periodDraft.finalEnd} onChangeText={(v) => setPeriodDraft((s) => ({ ...s, finalEnd: v }))} />

              <TouchableOpacity style={styles.primaryBtn} onPress={savePeriods}>
                <Icon name="save-outline" size={16} color="#fff" />
                <Text style={styles.primaryText}>{t("common.save")}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ================= CANDIDATES MODAL ================= */}
      <Modal visible={candidatesOpen} transparent animationType="slide" onRequestClose={() => setCandidatesOpen(false)}>
        <View style={styles.overlay}>
          <Pressable style={{ flex: 1 }} onPress={() => (Keyboard.dismiss(), setCandidatesOpen(false))} />
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Candidates · {PHASE_LABEL[candidatePhase]}</Text>
                <Text style={styles.modalSub}>Search and tap a child to add. Selected are saved for this concours.</Text>
              </View>
              <TouchableOpacity onPress={() => setCandidatesOpen(false)} style={styles.modalCloseBtn}>
                <Icon name="close" size={18} color="#111" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchRowLight}>
              <Icon name="search" size={16} color="#6B6B70" />
              <TextInput
                value={candidateSearch}
                onChangeText={setCandidateSearch}
                placeholder="Search name / identifier…"
                placeholderTextColor="#9CA3AF"
                style={styles.searchInputDark}
              />
            </View>

            <Text style={[styles.sectionTitle, { marginTop: 12 }]}>Selected ({selectedCandidateIds.length})</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10 }}>
              {selectedCandidateObjects.length ? (
                selectedCandidateObjects.map((c: any) => (
                  <View key={c.id} style={styles.selChip}>
                    <Text style={styles.selChipText} numberOfLines={1}>
                      {norm(c.firstName)} {norm(c.lastName)}
                    </Text>
                    <TouchableOpacity onPress={() => removeCandidate(c.id)} style={styles.selChipX}>
                      <Icon name="close" size={14} color="#111" />
                    </TouchableOpacity>
                  </View>
                ))
              ) : (
                <Text style={styles.helperText}>No candidate selected yet.</Text>
              )}
            </ScrollView>

            <View style={styles.divider} />

            <Text style={styles.sectionTitle}>Children list</Text>
            <ScrollView style={{ maxHeight: 360 }} keyboardShouldPersistTaps="handled">
              {candidatePool.map((c: any) => {
                const on = selectedCandidateSet.has(c.id);
                return (
                  <TouchableOpacity
                    key={c.id}
                    style={[styles.pickRow, on && styles.pickRowOn]}
                    onPress={() => addCandidate(c.id)}
                    activeOpacity={0.9}
                  >
                    <View style={styles.pickLeft}>
                      <Icon
                        name={on ? "checkmark-circle" : "ellipse-outline"}
                        size={20}
                        color={on ? COLORS.light.primary : "#9CA3AF"}
                      />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.pickName} numberOfLines={1}>
                        {norm(c.firstName)} {norm(c.lastName)}
                      </Text>
                      <Text style={styles.pickSub} numberOfLines={1}>
                        ID: {norm(c.identifier) || "—"} · {norm(c.country) || "—"} / {norm(c.city) || "—"}
                      </Text>
                    </View>
                    <View style={styles.pickRight}>
                      <Text style={styles.pickTag}>{on ? "ADDED" : "ADD"}</Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            <TouchableOpacity style={styles.primaryBtn} onPress={saveCandidates}>
              <Icon name="save-outline" size={16} color="#fff" />
              <Text style={styles.primaryText}>{t("common.save")}</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ================= PASSED MODAL ================= */}
      <Modal visible={passedOpen} transparent animationType="slide" onRequestClose={() => setPassedOpen(false)}>
        <View style={styles.overlay}>
          <Pressable style={{ flex: 1 }} onPress={() => (Keyboard.dismiss(), setPassedOpen(false))} />
          <View style={styles.modal}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Passed → Next · {PHASE_LABEL[passedPhase]}</Text>
                <Text style={styles.modalSub}>
                  Check passed candidates and set their average. Saved results can be searched by identifier on your Jeunesse page.
                </Text>
              </View>
              <TouchableOpacity onPress={() => setPassedOpen(false)} style={styles.modalCloseBtn}>
                <Icon name="close" size={18} color="#111" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchRowLight}>
              <Icon name="search" size={16} color="#6B6B70" />
              <TextInput
                value={passedSearch}
                onChangeText={setPassedSearch}
                placeholder="Search name / identifier…"
                placeholderTextColor="#9CA3AF"
                style={styles.searchInputDark}
              />
            </View>

            <ScrollView style={{ maxHeight: 420 }} keyboardShouldPersistTaps="handled">
              {passedList.length ? (
                passedList.map((c: any) => {
                  const id = c.id;
                  const row = passedMap[id] || { passed: false, average: "" };
                  return (
                    <View key={id} style={styles.passRow}>
                      <TouchableOpacity onPress={() => togglePassed(id)} style={styles.passCheck} activeOpacity={0.9}>
                        <Icon
                          name={row.passed ? "checkbox" : "square-outline"}
                          size={22}
                          color={row.passed ? COLORS.light.primary : "#9CA3AF"}
                        />
                      </TouchableOpacity>

                      <View style={{ flex: 1 }}>
                        <Text style={styles.pickName} numberOfLines={1}>
                          {norm(c.firstName)} {norm(c.lastName)}
                        </Text>
                        <Text style={styles.pickSub} numberOfLines={1}>
                          ID: {norm(c.identifier) || "—"} · {norm(c.country) || "—"} / {norm(c.city) || "—"}
                        </Text>
                      </View>

                      <View style={styles.avgBox}>
                        <Text style={styles.avgLabel}>Avg</Text>
                        <TextInput
                          value={row.average}
                          onChangeText={(v) => setAverage(id, v)}
                          placeholder="0"
                          placeholderTextColor="#9CA3AF"
                          keyboardType={Platform.OS === "ios" ? "decimal-pad" : "numeric"}
                          style={styles.avgInput}
                        />
                      </View>
                    </View>
                  );
                })
              ) : (
                <View style={{ paddingVertical: 16 }}>
                  <Text style={styles.helperText}>No candidates in this phase yet. Add candidates first.</Text>
                </View>
              )}
            </ScrollView>

            <TouchableOpacity style={styles.primaryBtn} onPress={savePassedAndMoveNext}>
              <Icon name="checkmark-done-outline" size={16} color="#fff" />
              <Text style={styles.primaryText}>Save & Move to Next Concours</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* ================= QUIZ MODAL (MULTI QUESTIONS) ================= */}
      <Modal visible={quizOpen} transparent animationType="slide" onRequestClose={() => setQuizOpen(false)}>
        <View style={styles.overlay}>
          <Pressable style={{ flex: 1 }} onPress={() => (Keyboard.dismiss(), setQuizOpen(false))} />
          <View style={styles.modal}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>{t("adminJeunesse.quiz.manage")}</Text>
                  <Text style={styles.modalSub}>Create / update multi-question quiz</Text>
                </View>
                <TouchableOpacity onPress={() => setQuizOpen(false)} style={styles.modalCloseBtn}>
                  <Icon name="close" size={18} color="#111" />
                </TouchableOpacity>
              </View>

              <Field
                label="Quiz Title"
                value={quizDraft.title}
                onChangeText={(v) => setQuizDraft((s) => ({ ...s, title: v }))}
              />

              <FieldInline
                label="Duration (seconds)"
                value={quizDraft.durationSec}
                onChangeText={(v: any) => setQuizDraft((s) => ({ ...s, durationSec: v }))}
                placeholder="60"
                keyboardType="numeric"
              />

              <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <Text style={styles.label}>Set as Active Quiz</Text>
                <TouchableOpacity
                  onPress={() => setQuizDraft((s) => ({ ...s, isActive: !s.isActive }))}
                  activeOpacity={0.9}
                  style={[
                    styles.smallBtn,
                    { backgroundColor: quizDraft.isActive ? "rgba(47,165,169,0.12)" : "#F3F4F6" },
                  ]}
                >
                  <Icon name={quizDraft.isActive ? "checkmark-circle" : "ellipse-outline"} size={16} color="#111" />
                  <Text style={styles.smallBtnText}>{quizDraft.isActive ? "YES" : "NO"}</Text>
                </TouchableOpacity>
              </View>

              <Text style={styles.sectionTitle}>Questions ({quizDraft.questions.length})</Text>

              {quizDraft.questions.length ? (
                <View style={{ gap: 10 }}>
                  {quizDraft.questions.map((q, index) => (
                    <View key={q.id} style={styles.pickRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.pickName} numberOfLines={2}>
                          {index + 1}. {q.text}
                        </Text>
                        <Text style={styles.pickSub} numberOfLines={2}>
                          Correct: {q.options?.[q.answerIndex] || "—"}
                        </Text>
                      </View>

                      <TouchableOpacity onPress={() => openEditQuestion(q, index)} style={styles.iconMiniBtn} activeOpacity={0.9}>
                        <Icon name="create-outline" size={18} color="#111" />
                      </TouchableOpacity>

                      <TouchableOpacity onPress={() => deleteQuestion(index)} style={styles.iconMiniBtn} activeOpacity={0.9}>
                        <Icon name="trash-outline" size={18} color="#111" />
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={styles.helperText}>No questions yet. Tap “Add Question”.</Text>
              )}

              <TouchableOpacity style={styles.primaryBtn} onPress={openAddQuestion}>
                <Icon name="add" size={16} color="#fff" />
                <Text style={styles.primaryText}>Add Question</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.primaryBtn} onPress={saveQuiz}>
                <Icon name="save-outline" size={16} color="#fff" />
                <Text style={styles.primaryText}>{t("common.save")}</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ================= QUESTION MODAL ================= */}
      <Modal visible={questionModal} transparent animationType="slide" onRequestClose={() => setQuestionModal(false)}>
        <View style={styles.overlay}>
          <Pressable style={{ flex: 1 }} onPress={() => (Keyboard.dismiss(), setQuestionModal(false))} />
          <View style={styles.modal}>
            <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>{editingQuestionIndex === null ? "Add Question" : "Edit Question"}</Text>
                  <Text style={styles.modalSub}>4 options, choose correct answer index (0-3)</Text>
                </View>
                <TouchableOpacity onPress={() => setQuestionModal(false)} style={styles.modalCloseBtn}>
                  <Icon name="close" size={18} color="#111" />
                </TouchableOpacity>
              </View>

              <Field
                label="Question"
                value={questionDraft.text}
                onChangeText={(v) => setQuestionDraft((s) => ({ ...s, text: v }))}
              />

              <Text style={styles.sectionTitle}>Options</Text>
              {(questionDraft.options || ["", "", "", ""]).map((op, idx) => (
                <Field
                  key={idx}
                  label={`Option ${idx + 1}`}
                  value={op}
                  onChangeText={(v) => {
                    const arr = [...(questionDraft.options || ["", "", "", ""])];
                    arr[idx] = v;
                    setQuestionDraft((s) => ({ ...s, options: arr }));
                  }}
                />
              ))}

              <FieldInline
                label="Correct answer index (0-3)"
                value={String(questionDraft.answerIndex)}
                onChangeText={(v: any) => {
                  const n = Number(String(v || "0").replace(/[^\d]/g, "")) || 0;
                  setQuestionDraft((s) => ({ ...s, answerIndex: Math.max(0, Math.min(3, n)) }));
                }}
                placeholder="0"
                keyboardType="numeric"
              />

              <TouchableOpacity style={styles.primaryBtn} onPress={saveQuestion}>
                <Icon name="save-outline" size={16} color="#fff" />
                <Text style={styles.primaryText}>Save Question</Text>
              </TouchableOpacity>
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
}

/* ================= UI PARTS ================= */
function Pill({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={[styles.pill, active && styles.pillActive]}>
      <Text style={[styles.pillText, active && styles.pillTextActive]}>{label}</Text>
    </TouchableOpacity>
  );
}

function Field({
  label,
  value,
  onChangeText,
  placeholder,
  keyboardType,
}: {
  label: string;
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
  keyboardType?: any;
}) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor="#9CA3AF"
        keyboardType={keyboardType}
        style={styles.input}
      />
    </View>
  );
}

function FieldInline(props: any) {
  return (
    <View style={{ flex: 1, marginBottom: 12 }}>
      <Text style={styles.label}>{props.label}</Text>
      <TextInput {...props} placeholderTextColor="#9CA3AF" style={styles.input} />
    </View>
  );
}

function DropdownField({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TouchableOpacity onPress={onPress} activeOpacity={0.9} style={styles.dropdown}>
        <Text style={styles.dropdownText} numberOfLines={1}>
          {value ? value : "— Select —"}
        </Text>
        <Icon name="chevron-down" size={18} color="#111" />
      </TouchableOpacity>
    </View>
  );
}

/* ================= STYLES ================= */
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F4F5F7" },

  hero: {
    backgroundColor: "#0E0E10",
    borderBottomLeftRadius: 22,
    borderBottomRightRadius: 22,
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 14,
  },
  heroTop: { flexDirection: "row", alignItems: "center", gap: 12 },
  backBtn: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  heroTitle: { color: "#fff", fontSize: 20, fontWeight: "900" },
  heroSub: { marginTop: 4, color: "rgba(255,255,255,0.7)", fontWeight: "700", fontSize: 12.5 },

  heroAction: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },

  searchRow: {
    marginTop: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(255,255,255,0.10)",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  searchInput: { flex: 1, color: "#fff", fontWeight: "800" },
  filterBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },

  pills: { marginTop: 12, flexDirection: "row", gap: 8, flexWrap: "wrap" },
  pill: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  pillActive: { backgroundColor: "#fff" },
  pillText: { color: "rgba(255,255,255,0.78)", fontWeight: "900", fontSize: 12 },
  pillTextActive: { color: "#111" },

  center: { flex: 1, alignItems: "center", justifyContent: "center" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 14,
    flexDirection: "row",
    gap: 12,
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 3,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#EEF0F3",
    marginBottom: 12,
  },
  cardLeft: { width: 54, height: 54 },
  avatarFallback: {
    width: 54,
    height: 54,
    borderRadius: 18,
    backgroundColor: "rgba(47,165,169,0.10)",
    alignItems: "center",
    justifyContent: "center",
  },
  rowBetween: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  name: { fontSize: 15.5, fontWeight: "900", color: "#111", flex: 1 },
  email: { marginTop: 6, fontSize: 12.5, color: "#6B6B70", fontWeight: "700" },
  metaRow: { marginTop: 6 },
  metaText: { fontSize: 12, fontWeight: "800", color: "#6B6B70" },

  badgePill: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999 },
  badgeText: { fontSize: 10.5, fontWeight: "900" },

  trashBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },

  empty: { padding: 22, alignItems: "center" },
  emptyMini: { padding: 18, alignItems: "center" },
  emptyTitle: { marginTop: 10, fontSize: 16, fontWeight: "900", color: "#111" },
  emptySub: { marginTop: 6, fontSize: 12.5, color: "#6B6B70", fontWeight: "700", textAlign: "center" },

  overlay: { flex: 1, backgroundColor: "rgba(0,0,0,0.42)", justifyContent: "flex-end" },
  overlayCenter: { flex: 1, backgroundColor: "rgba(0,0,0,0.42)", justifyContent: "center" },

  modal: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 18,
    maxHeight: "92%",
  },

  pickerBox: {
    marginHorizontal: 14,
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 16,
    maxHeight: "80%",
  },

  modalHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  modalTitle: { fontSize: 18, fontWeight: "900", color: "#111" },
  modalSub: { marginTop: 4, fontSize: 12.5, fontWeight: "700", color: "#6B6B70" },
  modalCloseBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },

  divider: { height: 1, backgroundColor: "#EEF0F3", marginVertical: 14 },

  sectionCard: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: "#EEF0F3",
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 16,
    elevation: 2,
  },
  sectionTitle: { fontSize: 14.5, fontWeight: "900", color: "#111", marginBottom: 10 },
  helperText: { fontSize: 12.5, color: "#6B6B70", fontWeight: "700" },

  roomRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 12,
    borderWidth: 1,
    borderColor: "#EEF0F3",
    marginBottom: 10,
  },
  roomIcon: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  roomName: { fontSize: 13.5, fontWeight: "900", color: "#111" },
  roomSub: { marginTop: 4, fontSize: 12, fontWeight: "800", color: "#6B6B70" },
  smallIconBtn: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },

  concoursBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#EEF0F3",
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
    backgroundColor: "#fff",
  },

  label: { fontSize: 12, fontWeight: "900", color: "#111", marginBottom: 8 },

  input: {
    backgroundColor: "#F3F4F6",
    borderRadius: 14,
    padding: 14,
    fontSize: 14,
    fontWeight: "800",
    color: "#111",
  },

  twoBtns: { flexDirection: "row", gap: 10 },

  primaryBtn: {
    backgroundColor: COLORS.light.primary,
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: "center",
    marginTop: 10,
    flexDirection: "row",
    justifyContent: "center",
    gap: 8,
  },
  primaryText: { color: "#fff", fontWeight: "900" },

  grayBtn: {
    backgroundColor: "#F3F4F6",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  grayBtnText: { fontWeight: "900", color: "#111" },

  badgeLine: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10, marginBottom: 10 },
  smallBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#F3F4F6",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  smallBtnText: { fontWeight: "900", color: "#111", fontSize: 12 },

  iconMiniBtn: {
    width: 38,
    height: 38,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
    marginLeft: 8,
  },

  dropdown: {
    backgroundColor: "#F3F4F6",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dropdownText: { fontWeight: "800", color: "#111", flex: 1, paddingRight: 10 },

  searchRowLight: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "#F3F4F6",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 10,
  },
  searchInputDark: { flex: 1, color: "#111", fontWeight: "800" },
  pickItem: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
  },
  pickText: { fontWeight: "800", color: "#111" },

  selChip: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(47,165,169,0.12)",
    borderRadius: 999,
    paddingLeft: 12,
    paddingRight: 8,
    paddingVertical: 10,
    gap: 10,
  },
  selChipText: { fontWeight: "900", color: "#0F766E", maxWidth: 170 },
  selChipX: {
    width: 26,
    height: 26,
    borderRadius: 10,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },

  pickRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#EEF0F3",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  pickRowOn: { backgroundColor: "rgba(47,165,169,0.06)", borderColor: "rgba(47,165,169,0.35)" },
  pickLeft: { width: 26, alignItems: "center" },
  pickName: { fontWeight: "900", color: "#111" },
  pickSub: { marginTop: 4, fontWeight: "800", color: "#6B6B70", fontSize: 12 },
  pickRight: { marginLeft: 8 },
  pickTag: { fontWeight: "900", color: "#111", fontSize: 11 },

  passRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#EEF0F3",
    borderRadius: 14,
    padding: 12,
    marginBottom: 10,
    backgroundColor: "#fff",
  },
  passCheck: { width: 30, alignItems: "center" },
  avgBox: {
    width: 86,
    backgroundColor: "#F3F4F6",
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 8,
    alignItems: "stretch",
  },
  avgLabel: { fontWeight: "900", color: "#6B6B70", fontSize: 11 },
  avgInput: { paddingVertical: 6, fontWeight: "900", color: "#111" },
});
