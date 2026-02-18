/* eslint-disable react-native/no-inline-styles */
/* eslint-disable react/no-unstable-nested-components */
/* Jeunesse.tsx — User side (Portal)
   ✅ Hero redesigned to MATCH your Home screen style + scroll experience
   ✅ NO animated height (so no "style property height is not supported")
   ✅ Hero is FIXED (absolute) and FEED scrolls under it
   ✅ Tabs + menu NEVER disappear (pinned top row)
   ✅ Search/identifier area expands MORE when needed
*/

import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Modal,
  FlatList,
  Alert,
  ActivityIndicator,
  StyleSheet,
  Platform,
  KeyboardAvoidingView,
  Pressable,
  StatusBar,
  Animated,
} from "react-native";
import Icon from "react-native-vector-icons/Ionicons";
import { useTranslation } from "react-i18next";
import { db } from "../auth/firebaseConfig";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  where,
} from "firebase/firestore";

type TabKey = "home" | "results" | "quiz" | "register" | "history";

const SETTINGS_DOC = "global";
const PHASES = ["prelim", "preselection", "selection", "final"] as const;
type Phase = (typeof PHASES)[number];

function norm(s: any) {
  return String(s || "").trim();
}

function genIdentifier() {
  return (
    "J" +
    Date.now().toString(36).slice(-6).toUpperCase() +
    Math.random().toString(36).slice(2, 6).toUpperCase()
  );
}

function parseQuiz(activeQuiz: any, t: any) {
  if (!activeQuiz) return { title: "", durationSec: 60, questions: [] as any[] };

  const durationSec = Number(activeQuiz.durationSec || 60);
  const title = norm(activeQuiz.title) || (t("jeunesse.weeklyQuiz") || "Quiz");

  if (Array.isArray(activeQuiz.questions) && activeQuiz.questions.length) {
    return { title, durationSec, questions: activeQuiz.questions };
  }

  const q = norm(activeQuiz.question);
  const optionsObj = activeQuiz.options || {};
  const options = [optionsObj.A, optionsObj.B, optionsObj.C, optionsObj.D]
    .map((x: any) => norm(x))
    .filter(Boolean);

  const correct = String(activeQuiz.correct || "A").toUpperCase();
  const answerIndex = ["A", "B", "C", "D"].indexOf(correct);

  if (!q || options.length < 2 || answerIndex < 0) {
    return { title, durationSec, questions: [] as any[] };
  }

  return {
    title,
    durationSec,
    questions: [
      {
        id: activeQuiz.id || "q1",
        text: q,
        options,
        answerIndex,
      },
    ],
  };
}

/* ===================== HERO TOKENS (match Home screen style) ===================== */
const HERO_BG = "#fff";
const HERO_TEXT = "rgba(6, 51, 37, 0.91)";
const HERO_ICON_BG = "rgba(219, 219, 219, 0.55)";
const HERO_RADIUS = 24;

const HERO_EXPANDED = Platform.select({ ios: 300, android: 150 }) as number;
const HERO_COLLAPSED = Platform.select({ ios: 126, android: 130 }) as number;
const HERO_SEARCH_EXPANDED = Platform.select({ ios: 390, android: 280 }) as number;

export default function Jeunesse() {
  const { t } = useTranslation();

  const currentYear = useMemo(() => String(new Date().getFullYear()), []);
  const [tab, setTab] = useState<TabKey>("home");

  const [bootLoading, setBootLoading] = useState(true);

  // Settings / years
  const [settings, setSettings] = useState<any>(null);
  const [year, setYear] = useState(currentYear);
  const [yearPickerOpen, setYearPickerOpen] = useState(false);

  // Identifier
  const [identifier, setIdentifier] = useState("");

  // Results search
  const [checking, setChecking] = useState(false);
  const [resultRows, setResultRows] = useState<any[]>([]);

  // Quiz
  const [quizLoading, setQuizLoading] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState<any | null>(null);

  const [quizOpen, setQuizOpen] = useState(false);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<any>(null);

  // Quiz history
  const [histLoading, setHistLoading] = useState(false);
  const [attempts, setAttempts] = useState<any[]>([]);

  // Registration
  const [savingReg, setSavingReg] = useState(false);
  const [reg, setReg] = useState({
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
  });

  // Candidate list modal
  const [listOpen, setListOpen] = useState(false);
  const [listTitle, setListTitle] = useState("");
  const [listItems, setListItems] = useState<any[]>([]);

  // Hero behavior (like Home)
  const scrollY = useRef(new Animated.Value(0)).current;
  const [compact, setCompact] = useState(false);
  const [showIdBar, setShowIdBar] = useState(true); // collapsible area toggle
  const [forceHeroOpen, setForceHeroOpen] = useState(false);

  const idInputRef = useRef<TextInput>(null);

  // ---------- Load boot ----------
  useEffect(() => {
    (async () => {
      try {
        setBootLoading(true);
        await Promise.all([loadSettings(), loadActiveQuiz()]);
      } finally {
        setBootLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadSettings = async () => {
    const ref = doc(db, "jeunesse_settings", SETTINGS_DOC);
    const snap = await getDoc(ref);
    setSettings(snap.exists() ? snap.data() : {});
  };

  const loadActiveQuiz = async () => {
    setQuizLoading(true);
    try {
      let snap = await getDocs(
        query(collection(db, "jeunesse_quizzes"), orderBy("createdAt", "desc"), limit(1))
      );

      if (snap.empty) {
        snap = await getDocs(
          query(collection(db, "jeunesse_quizzes"), orderBy("createdAt", "desc"), limit(1))
        );
      }

      if (snap.empty) {
        setActiveQuiz(null);
        return;
      }

      const d = snap.docs[0];
      setActiveQuiz({ id: d.id, ...d.data() });
    } catch {
      setActiveQuiz(null);
    } finally {
      setQuizLoading(false);
    }
  };

  const availableYears = useMemo(() => {
    const years = Object.keys(settings?.years || {});
    const list = years.length ? years : [currentYear];
    if (!list.includes(currentYear)) list.push(currentYear);
    return list.sort((a, b) => b.localeCompare(a));
  }, [settings, currentYear]);

  const periodsForYear = useMemo(() => {
    const y = (settings?.years || {})[year] || {};
    const p = y?.periods || {};
    return {
      prelim: p?.prelim || {},
      preselection: p?.preselection || {},
      selection: p?.selection || {},
      final: p?.final || {},
    };
  }, [settings, year]);

  const concoursForYear = useMemo(() => {
    const y = (settings?.years || {})[year] || {};
    const c = y?.concours || {};
    return {
      prelim: c?.prelim || { candidates: [], passed: {} },
      preselection: c?.preselection || { candidates: [], passed: {} },
      selection: c?.selection || { candidates: [], passed: {} },
      final: c?.final || { candidates: [], passed: {} },
    };
  }, [settings, year]);

  const phaseLabel = (p: Phase) => t(`jeunesse.ui.phases.${p}`) || p;

  // ================== SCROLL EXPERIENCE (same as Home) ==================
  const expandedHeight = showIdBar ? HERO_SEARCH_EXPANDED : HERO_EXPANDED;
  const collapseDist = expandedHeight - HERO_COLLAPSED;
  const clamped = Animated.diffClamp(scrollY, 0, collapseDist);

  const collapse = useMemo(() => {
    if (forceHeroOpen || showIdBar) return new Animated.Value(0);
    return clamped;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forceHeroOpen, showIdBar, collapseDist]);

  const expandableTranslateY = Animated.multiply(collapse, -1);
  const expandableOpacity = collapse.interpolate({
    inputRange: [0, collapseDist * 0.6, collapseDist],
    outputRange: [1, 0.2, 0],
    extrapolate: "clamp",
  });

  useEffect(() => {
    const sub = scrollY.addListener(({ value }) => {
      if (forceHeroOpen || showIdBar) {
        if (compact) setCompact(false);
        return;
      }
      const should = value > 70;
      if (should !== compact) setCompact(should);
    });
    return () => scrollY.removeListener(sub);
  }, [scrollY, compact, forceHeroOpen, showIdBar]);

  const heroFixedHeight =
    forceHeroOpen || showIdBar ? expandedHeight : compact ? HERO_COLLAPSED : expandedHeight;

  // ---------- Results: search jeunesse_results by identifier + year ----------
  const checkResultsByIdentifier = async () => {
    const idf = identifier.trim();
    if (!idf) {
      Alert.alert(
        t("jeunesse.ui.alerts.enterIdentifierTitle") || t("jeunesse.results") || "Results",
        t("jeunesse.ui.alerts.enterIdentifierMsg") || t("jeunesse.enterIdentifier") || "Enter identifier"
      );
      return;
    }

    setChecking(true);
    setResultRows([]);
    try {
      const qy = query(
        collection(db, "jeunesse_results"),
        where("identifier", "==", idf),
        where("year", "==", year)
      );
      const snap = await getDocs(qy);

      if (snap.empty) {
        Alert.alert(t("jeunesse.results") || "Results", t("jeunesse.noResults") || "No results");
        return;
      }

      const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const order: Record<string, number> = { prelim: 0, preselection: 1, selection: 2, final: 3 };
      rows.sort((a, b) => (order[a.phase] ?? 99) - (order[b.phase] ?? 99));

      setResultRows(rows);
      setTab("results");
    } catch (e: any) {
      Alert.alert(t("jeunesse.results") || "Results", e?.message || "Error");
    } finally {
      setChecking(false);
    }
  };

  // ---------- Candidates list modal ----------
  const openPhaseCandidates = async (phase: Phase) => {
    try {
      const ids: string[] = (concoursForYear?.[phase]?.candidates || []) as string[];
      if (!ids.length) {
        Alert.alert(
          t("jeunesse.ui.candidatesModal.candidatesTitle") || "Candidates",
          t("jeunesse.ui.candidatesModal.noCandidates") || "No candidates set for this phase yet."
        );
        return;
      }

      const chunks: string[][] = [];
      for (let i = 0; i < ids.length; i += 10) chunks.push(ids.slice(i, i + 10));

      const all: any[] = [];
      for (const ch of chunks) {
        const qy = query(collection(db, "jeunesse_children"), where("__name__", "in", ch));
        const snap = await getDocs(qy);
        snap.docs.forEach((d) => all.push({ id: d.id, ...d.data() }));
      }

      const map = new Map(all.map((c) => [c.id, c]));
      const ordered = ids.map((id) => map.get(id)).filter(Boolean);

      setListTitle(
        `${phaseLabel(phase)} · ${t("jeunesse.ui.candidatesModal.candidatesTitle") || "Candidates"} (${ids.length})`
      );
      setListItems(ordered);
      setListOpen(true);
    } catch (e: any) {
      Alert.alert(t("jeunesse.ui.candidatesModal.candidatesTitle") || "Candidates", e?.message || "Error");
    }
  };

  // ---------- Registration ----------
  const registerChild = async () => {
    const required = [
      "firstName",
      "lastName",
      "age",
      "currentClass",
      "academicYear",
      "parishName",
      "contactEmail",
      "country",
      "city",
    ];
    for (const k of required) {
      // @ts-ignore
      if (!String(reg[k] || "").trim()) {
        Alert.alert(
          t("jeunesse.ui.tabs.register") || "Register",
          t("jeunesse.ui.register.requiredFields") || "Please fill all required fields."
        );
        return;
      }
    }

    setSavingReg(true);
    try {
      const idf = genIdentifier();

      const payload = {
        identifier: idf,
        firstName: reg.firstName.trim(),
        lastName: reg.lastName.trim(),
        age: Number(reg.age || 0),
        currentClass: reg.currentClass.trim(),
        academicYear: reg.academicYear.trim(),
        parishName: reg.parishName.trim(),
        parishShepherdNames: reg.parishShepherdNames.trim(),
        mainTeacherNames: reg.mainTeacherNames.trim(),
        shepherdPhone: reg.shepherdPhone.trim(),
        teacherPhone: reg.teacherPhone.trim(),
        contactEmail: reg.contactEmail.trim(),
        country: reg.country.trim(),
        province: reg.province.trim(),
        city: reg.city.trim(),
        region: reg.region.trim(),
        subRegion: reg.subRegion.trim(),
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      await addDoc(collection(db, "jeunesse_children"), payload);

      Alert.alert(t("jeunesse.saved") || "Saved", `${t("jeunesse.identifier") || "Identifier"}: ${idf}`);

      setIdentifier(idf);
      setReg({
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
      });
      setTab("results");
      setShowIdBar(true);
      setForceHeroOpen(true);
      setTimeout(() => idInputRef.current?.focus(), 250);
    } catch (e: any) {
      Alert.alert(t("jeunesse.saveFailed") || "Save failed", e?.message || "Error");
    } finally {
      setSavingReg(false);
    }
  };

  // ---------- Quiz ----------
  const { title: quizTitle, durationSec, questions } = useMemo(() => parseQuiz(activeQuiz, t), [activeQuiz, t]);
  const currentQ = questions[quizIndex];

  const startQuiz = async () => {
    if (!activeQuiz || !questions.length) {
      Alert.alert(t("jeunesse.ui.alerts.quizTitle") || t("jeunesse.weeklyQuiz") || "Quiz", t("jeunesse.quizNotAvailable") || "No quiz available");
      return;
    }

    if (!identifier.trim()) {
      setShowIdBar(true);
      setForceHeroOpen(true);
      setTimeout(() => idInputRef.current?.focus(), 200);
      Alert.alert(t("jeunesse.identifier") || "Identifier", t("jeunesse.enterIdentifier") || "Enter identifier first");
      return;
    }

    setQuizLoading(true);
    try {
      const qy = query(collection(db, "jeunesse_quiz_attempts"), where("identifier", "==", identifier.trim()), limit(1));
      const snap = await getDocs(qy);
      if (!snap.empty) {
        Alert.alert(t("jeunesse.ui.alerts.quizTitle") || t("jeunesse.weeklyQuiz") || "Quiz", t("jeunesse.alreadyPlayed") || "Already played");
        return;
      }

      setQuizAnswers({});
      setQuizIndex(0);
      setTimeLeft(durationSec);
      setQuizOpen(true);

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimeLeft((s) => {
          if (s <= 1) {
            clearInterval(timerRef.current);
            timerRef.current = null;
            setTimeout(() => submitQuiz(true), 80);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } catch (e: any) {
      Alert.alert(t("jeunesse.ui.alerts.quizTitle") || "Quiz", e?.message || "Error");
    } finally {
      setQuizLoading(false);
    }
  };

  const chooseAnswer = (qid: string, index: number) => setQuizAnswers((prev) => ({ ...prev, [qid]: index }));

  const submitQuiz = async (auto = false) => {
    if (!activeQuiz) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    let score = 0;
    for (const q of questions) {
      const a = quizAnswers[q.id];
      if (typeof a === "number" && a === q.answerIndex) score++;
    }

    try {
      await addDoc(collection(db, "jeunesse_quiz_attempts"), {
        quizId: activeQuiz.id,
        identifier: identifier.trim(),
        score,
        total: questions.length,
        durationSec,
        startedAt: Date.now() - (durationSec - timeLeft) * 1000,
        submittedAt: Date.now(),
        autoSubmitted: !!auto,
      });

      Alert.alert(
        t("jeunesse.ui.alerts.quizTitle") || t("jeunesse.weeklyQuiz") || "Quiz",
        t("jeunesse.ui.history.scoreLabel", { score, total: questions.length }) || `Score: ${score}/${questions.length}`
      );

      setQuizOpen(false);
      if (tab === "history") await loadQuizHistory();
    } catch (e: any) {
      Alert.alert(t("jeunesse.ui.alerts.quizTitle") || "Quiz", e?.message || "Error");
      setQuizOpen(false);
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  // ---------- Quiz history ----------
  const loadQuizHistory = async () => {
    if (!identifier.trim()) {
      setShowIdBar(true);
      setForceHeroOpen(true);
      setTimeout(() => idInputRef.current?.focus(), 200);
      Alert.alert(t("jeunesse.ui.alerts.historyTitle") || "History", t("jeunesse.ui.alerts.historyEnterId") || "Enter your identifier first.");
      return;
    }
    setHistLoading(true);
    try {
      const qy = query(collection(db, "jeunesse_quiz_attempts"), where("identifier", "==", identifier.trim()), limit(50));
      const snap = await getDocs(qy);
      setAttempts(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    } catch (e: any) {
      Alert.alert(t("jeunesse.ui.alerts.historyTitle") || "History", e?.message || "Error");
    } finally {
      setHistLoading(false);
    }
  };

  useEffect(() => {
    if (tab === "history" && identifier.trim()) loadQuizHistory();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab]);

  // ================== HERO UI (pinned) ==================
  const Header = () => (
    <View style={[hero.heroContainer, { height: heroFixedHeight }]}>
      <View style={hero.heroPinnedTop}>
        <View style={hero.heroTopLeft}>
          <View style={hero.heroIcon}>
            <Icon name="leaf-outline" size={18} color={HERO_TEXT} />
          </View>

          <View style={{ flex: 1 }}>
            <Text style={hero.heroTitle} numberOfLines={1}>
              {t("jeunesse.title") || "Jeunesse"}
            </Text>
            {!compact && (
              <Text style={hero.heroSub} numberOfLines={1}>
                {(t("jeunesse.childrenAndYouth") || "Children & Youth") + " · " + (t("jeunesse.amisDeJesus") || "Amis de Jésus")}
              </Text>
            )}
          </View>
        </View>

        <View style={hero.heroTopRight}>
          <TouchableOpacity onPress={() => setYearPickerOpen(true)} style={hero.yearPill} activeOpacity={0.9}>
            <Icon name="calendar-outline" size={16} color={HERO_TEXT} />
            <Text style={hero.yearPillText}>{year}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={() => {
              const next = !showIdBar;
              setShowIdBar(next);
              setForceHeroOpen(next);
              if (next) setTimeout(() => idInputRef.current?.focus(), 120);
            }}
            style={hero.heroIcon}
            activeOpacity={0.9}
          >
            <Icon name={showIdBar ? "close" : "search"} size={18} color={HERO_TEXT} />
          </TouchableOpacity>
        </View>
      </View>

      {/* TABS stay visible always */}
      <View style={{ marginTop: 10 }}>
        <TabsRow tab={tab} setTab={setTab} compact={compact} />
      </View>

      {/* Expandable section (slides/clips) */}
      <Animated.View
        style={[
          hero.expandable,
          {
            transform: [{ translateY: expandableTranslateY }],
            opacity: expandableOpacity,
          },
        ]}
      >
        {showIdBar && (
          <View style={hero.idRow}>
            <Icon name="key-outline" size={16} color="rgba(6,51,37,0.75)" />
            <TextInput
              ref={idInputRef}
              value={identifier}
              onChangeText={setIdentifier}
              placeholder={t("jeunesse.enterIdentifier") || "Enter identifier (e.g. JXXXX)"}
              placeholderTextColor="rgba(6,51,37,0.45)"
              style={hero.idInput}
            />
            <TouchableOpacity onPress={checkResultsByIdentifier} style={hero.idBtn} activeOpacity={0.9}>
              {checking ? <ActivityIndicator color={HERO_TEXT} /> : <Icon name="search" size={18} color={HERO_TEXT} />}
            </TouchableOpacity>
          </View>
        )}

        {/* Quick action pills (nice like Home) */}
        {showIdBar && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={hero.quickRow}>
            <TouchableOpacity onPress={checkResultsByIdentifier} style={hero.quickPill} activeOpacity={0.9}>
              <Icon name="ribbon-outline" size={16} color={HERO_TEXT} />
              <Text style={hero.quickText}>{t("jeunesse.ui.tabs.results") || "Results"}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setTab("quiz")} style={hero.quickPill} activeOpacity={0.9}>
              <Icon name="help-circle-outline" size={16} color={HERO_TEXT} />
              <Text style={hero.quickText}>{t("jeunesse.ui.tabs.quiz") || "Quiz"}</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setTab("register")} style={hero.quickPill} activeOpacity={0.9}>
              <Icon name="person-add-outline" size={16} color={HERO_TEXT} />
              <Text style={hero.quickText}>{t("jeunesse.ui.tabs.register") || "Register"}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                setTab("history");
                if (identifier.trim()) loadQuizHistory();
              }}
              style={hero.quickPill}
              activeOpacity={0.9}
            >
              <Icon name="time-outline" size={16} color={HERO_TEXT} />
              <Text style={hero.quickText}>{t("jeunesse.ui.tabs.history") || "History"}</Text>
            </TouchableOpacity>
          </ScrollView>
        )}
      </Animated.View>
    </View>
  );

  // ================== TABS CONTENT ==================
  const HomeTab = () => (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{t("jeunesse.ui.home.title")}</Text>
          <View style={styles.badgeSoft}>
            <Text style={styles.badgeSoftText}>{t("jeunesse.ui.home.badgeYear", { year })}</Text>
          </View>
        </View>

        <Text style={styles.cardSub}>{t("jeunesse.ui.home.subtitle")}</Text>

        {PHASES.map((p) => {
          const per = (periodsForYear as any)[p] || {};
          const count = ((concoursForYear as any)[p]?.candidates || []).length;

          return (
            <View key={p} style={styles.phaseRow}>
              <View style={styles.phaseIcon}>
                <Icon name="trophy-outline" size={18} color="#111" />
              </View>

              <View style={{ flex: 1 }}>
                <Text style={styles.phaseName}>{phaseLabel(p)}</Text>
                <Text style={styles.phaseSub}>
                  {norm(per.start) || "—"} → {norm(per.end) || "—"} · {t("jeunesse.ui.home.candidatesCount", { count })}
                </Text>
              </View>

              <TouchableOpacity onPress={() => openPhaseCandidates(p)} style={styles.smallIconBtn} activeOpacity={0.9}>
                <Icon name="people-outline" size={18} color="#111" />
              </TouchableOpacity>
            </View>
          );
        })}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t("jeunesse.ui.home.quickActionsTitle")}</Text>
        <Text style={styles.cardSub}>{t("jeunesse.ui.home.quickActionsSub")}</Text>

        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap", marginTop: 10 }}>
          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#111827" }]} onPress={() => setShowIdBar(true)}>
            <Icon name="search" size={16} color="#fff" />
            <Text style={styles.actionBtnText}>{t("jeunesse.ui.home.searchResults")}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "#111827" }]} onPress={() => setTab("quiz")}>
            <Icon name="help" size={16} color="#fff" />
            <Text style={styles.actionBtnText}>{t("jeunesse.ui.home.openQuiz")}</Text>
          </TouchableOpacity>

          <TouchableOpacity style={[styles.actionBtn, { backgroundColor: "rgba(50, 221, 121, 0.7)" }]} onPress={() => setTab("register")}>
            <Icon name="person-add" size={16} color={HERO_TEXT} />
            <Text style={[styles.actionBtnText, { color: HERO_TEXT }]}>{t("jeunesse.ui.home.register")}</Text>
          </TouchableOpacity>
        </View>
      </View>
    </ScrollView>
  );

  const ResultsTab = () => (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{t("jeunesse.ui.results.title")}</Text>
          <TouchableOpacity onPress={checkResultsByIdentifier} style={styles.badgeSolid} activeOpacity={0.9}>
            <Icon name="search" size={14} color="#fff" />
            <Text style={styles.badgeSolidText}>{t("jeunesse.ui.results.search")}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.cardSub}>{t("jeunesse.ui.results.subtitle")}</Text>

        {checking ? (
          <View style={styles.centerMini}>
            <ActivityIndicator />
            <Text style={styles.helper}>{t("jeunesse.ui.results.checking")}</Text>
          </View>
        ) : resultRows.length ? (
          <View style={{ marginTop: 8 }}>
            {resultRows.map((r) => (
              <View key={r.id} style={styles.resultRow}>
                <View style={styles.resultIcon}>
                  <Icon name="ribbon-outline" size={18} color="#111" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.resultTitle}>{phaseLabel((r.phase || "prelim") as Phase)}</Text>
                  <Text style={styles.resultSub} numberOfLines={2}>
                    {norm(r.fullName) || "—"} · {t("jeunesse.ui.results.avg")}: {r.average == null ? "—" : String(r.average)}
                  </Text>
                </View>
                <View style={styles.badgeSoft}>
                  <Text style={styles.badgeSoftText}>{year}</Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyBlock}>
            <Icon name="search-outline" size={44} color="#C7C7CC" />
            <Text style={styles.emptyTitle}>{t("jeunesse.ui.results.emptyTitle")}</Text>
            <Text style={styles.emptySub}>{t("jeunesse.ui.results.emptySub")}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );

  const QuizTab = () => (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{t("jeunesse.ui.quiz.title")}</Text>
          <View style={styles.badgeSoft}>
            <Text style={styles.badgeSoftText}>{year}</Text>
          </View>
        </View>

        {quizLoading ? (
          <View style={styles.centerMini}>
            <ActivityIndicator />
            <Text style={styles.helper}>{t("jeunesse.ui.quiz.loading")}</Text>
          </View>
        ) : !activeQuiz || !questions.length ? (
          <View style={styles.emptyBlock}>
            <Icon name="help-circle-outline" size={44} color="#C7C7CC" />
            <Text style={styles.emptyTitle}>{t("jeunesse.ui.quiz.emptyTitle")}</Text>
            <Text style={styles.emptySub}>{t("jeunesse.ui.quiz.emptySub")}</Text>
          </View>
        ) : (
          <>
            <View style={styles.quizInfo}>
              <View style={styles.quizIcon}>
                <Icon name="sparkles-outline" size={18} color="#111" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.quizTitle} numberOfLines={2}>
                  {quizTitle}
                </Text>
                <Text style={styles.quizSub}>
                  {t("jeunesse.ui.quiz.questionsInfo", { count: questions.length, sec: durationSec })}
                </Text>
              </View>
            </View>

            <TouchableOpacity style={[styles.primaryBtn, { backgroundColor: "#111827" }]} onPress={startQuiz} activeOpacity={0.9}>
              <Icon name="play" size={16} color="#fff" />
              <Text style={styles.primaryBtnText}>{t("jeunesse.ui.quiz.start")}</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.secondaryBtn]}
              onPress={() => {
                setTab("history");
                if (identifier.trim()) loadQuizHistory();
              }}
              activeOpacity={0.9}
            >
              <Icon name="time-outline" size={16} color="#111" />
              <Text style={styles.secondaryBtnText}>{t("jeunesse.ui.quiz.viewHistory")}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>{t("jeunesse.ui.quiz.importantTitle")}</Text>
        <Text style={styles.cardSub}>{t("jeunesse.ui.quiz.importantSub")}</Text>
      </View>
    </ScrollView>
  );

  const RegisterTab = () => (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 50 }} showsVerticalScrollIndicator={false}>
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>{t("jeunesse.ui.register.title")}</Text>
            <View style={[styles.badgeSoft, { backgroundColor: "rgba(50, 221, 121, 0.14)" }]}>
              <Text style={[styles.badgeSoftText, { color: HERO_TEXT }]}>{t("jeunesse.ui.register.badgeNew")}</Text>
            </View>
          </View>

          <Text style={styles.cardSub}>{t("jeunesse.ui.register.subtitle")}</Text>

          <Field label={t("jeunesse.ui.fields.firstName")} value={reg.firstName} onChange={(v: string) => setReg((p) => ({ ...p, firstName: v }))} />
          <Field label={t("jeunesse.ui.fields.lastName")} value={reg.lastName} onChange={(v: string) => setReg((p) => ({ ...p, lastName: v }))} />

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field label={t("jeunesse.ui.fields.age")} value={reg.age} onChange={(v: string) => setReg((p) => ({ ...p, age: v }))} keyboardType="numeric" />
            </View>
            <View style={{ flex: 1 }}>
              <Field label={t("jeunesse.ui.fields.class")} value={reg.currentClass} onChange={(v: string) => setReg((p) => ({ ...p, currentClass: v }))} />
            </View>
          </View>

          <Field label={t("jeunesse.ui.fields.academicYear")} value={reg.academicYear} onChange={(v: string) => setReg((p) => ({ ...p, academicYear: v }))} />

          <View style={styles.divider} />

          <Field label={t("jeunesse.ui.fields.parishName")} value={reg.parishName} onChange={(v: string) => setReg((p) => ({ ...p, parishName: v }))} />
          <Field label={t("jeunesse.ui.fields.parishShepherdNames")} value={reg.parishShepherdNames} onChange={(v: string) => setReg((p) => ({ ...p, parishShepherdNames: v }))} />
          <Field label={t("jeunesse.ui.fields.mainTeacherNames")} value={reg.mainTeacherNames} onChange={(v: string) => setReg((p) => ({ ...p, mainTeacherNames: v }))} />

          <View style={{ flexDirection: "row", gap: 10 }}>
            <View style={{ flex: 1 }}>
              <Field label={t("jeunesse.ui.fields.shepherdPhone")} value={reg.shepherdPhone} onChange={(v: string) => setReg((p) => ({ ...p, shepherdPhone: v }))} />
            </View>
            <View style={{ flex: 1 }}>
              <Field label={t("jeunesse.ui.fields.teacherPhone")} value={reg.teacherPhone} onChange={(v: string) => setReg((p) => ({ ...p, teacherPhone: v }))} />
            </View>
          </View>

          <Field label={t("jeunesse.ui.fields.email")} value={reg.contactEmail} onChange={(v: string) => setReg((p) => ({ ...p, contactEmail: v }))} />

          <View style={styles.divider} />

          <Field label={t("jeunesse.ui.fields.country")} value={reg.country} onChange={(v: string) => setReg((p) => ({ ...p, country: v }))} />
          <Field label={t("jeunesse.ui.fields.province")} value={reg.province} onChange={(v: string) => setReg((p) => ({ ...p, province: v }))} />
          <Field label={t("jeunesse.ui.fields.city")} value={reg.city} onChange={(v: string) => setReg((p) => ({ ...p, city: v }))} />
          <Field label={t("jeunesse.ui.fields.region")} value={reg.region} onChange={(v: string) => setReg((p) => ({ ...p, region: v }))} />
          <Field label={t("jeunesse.ui.fields.subRegion")} value={reg.subRegion} onChange={(v: string) => setReg((p) => ({ ...p, subRegion: v }))} />

          <TouchableOpacity onPress={registerChild} style={[styles.primaryBtn, { backgroundColor: "rgba(50, 221, 121, 0.7)" }]} activeOpacity={0.9}>
            {savingReg ? <ActivityIndicator color={HERO_TEXT} /> : <Icon name="save-outline" size={16} color={HERO_TEXT} />}
            <Text style={[styles.primaryBtnText, { color: HERO_TEXT }]}>{t("jeunesse.ui.register.submit")}</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );

  const HistoryTab = () => (
    <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 40 }} showsVerticalScrollIndicator={false}>
      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <Text style={styles.cardTitle}>{t("jeunesse.ui.history.title")}</Text>
          <TouchableOpacity onPress={loadQuizHistory} style={styles.badgeSolid} activeOpacity={0.9}>
            <Icon name="refresh" size={14} color="#fff" />
            <Text style={styles.badgeSolidText}>{t("jeunesse.ui.history.refresh")}</Text>
          </TouchableOpacity>
        </View>

        <Text style={styles.cardSub}>{t("jeunesse.ui.history.subtitle")}</Text>

        {histLoading ? (
          <View style={styles.centerMini}>
            <ActivityIndicator />
            <Text style={styles.helper}>{t("jeunesse.ui.history.loading")}</Text>
          </View>
        ) : attempts.length ? (
          <View style={{ marginTop: 10 }}>
            {attempts.map((a) => (
              <View key={a.id} style={styles.attemptRow}>
                <View style={styles.attemptIcon}>
                  <Icon name="help-outline" size={18} color="#111" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.attemptTitle}>{t("jeunesse.ui.history.scoreLabel", { score: a.score, total: a.total })}</Text>
                  <Text style={styles.attemptSub}>
                    {a.submittedAt ? new Date(Number(a.submittedAt)).toLocaleString() : "—"} ·{" "}
                    {a.autoSubmitted ? t("jeunesse.ui.history.modeAuto") : t("jeunesse.ui.history.modeManual")}
                  </Text>
                </View>

                <View style={styles.badgeSoft}>
                  <Text style={styles.badgeSoftText}>
                    {a.total ? Math.round((Number(a.score) / Number(a.total)) * 100) : 0}%
                  </Text>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.emptyBlock}>
            <Icon name="time-outline" size={44} color="#C7C7CC" />
            <Text style={styles.emptyTitle}>{t("jeunesse.ui.history.emptyTitle")}</Text>
            <Text style={styles.emptySub}>{t("jeunesse.ui.history.emptySub")}</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );

  if (bootLoading) {
    return (
      <View style={[styles.screen, { justifyContent: "center", alignItems: "center" }]}>
        <ActivityIndicator size="large" />
        <Text style={{ marginTop: 10, fontWeight: "800", color: "#111" }}>
          {t("jeunesse.ui.misc.loading") || "Loading…"}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <StatusBar barStyle="dark-content" backgroundColor={HERO_BG} />

      {/* HERO (absolute, fixed height, no animated height) */}
      <Header />

      {/* CONTENT as FlatList-style scroll so hero collapses smoothly */}
      <Animated.ScrollView
        contentContainerStyle={{ paddingTop: heroFixedHeight + 12, paddingBottom: 24 }}
        showsVerticalScrollIndicator={false}
        onScroll={Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: true })}
        scrollEventThrottle={16}
      >
        {tab === "home" ? (
          <HomeTab />
        ) : tab === "results" ? (
          <ResultsTab />
        ) : tab === "quiz" ? (
          <QuizTab />
        ) : tab === "register" ? (
          <RegisterTab />
        ) : (
          <HistoryTab />
        )}
      </Animated.ScrollView>

      {/* ================= YEAR PICKER ================= */}
      <Modal visible={yearPickerOpen} transparent animationType="fade" onRequestClose={() => setYearPickerOpen(false)}>
        <View style={styles.overlayCenter}>
          <Pressable style={{ flex: 1 }} onPress={() => setYearPickerOpen(false)} />
          <View style={styles.pickerBox}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>{t("jeunesse.ui.picker.selectYear")}</Text>
                <Text style={styles.modalSub}>{t("jeunesse.ui.picker.sub")}</Text>
              </View>
              <TouchableOpacity onPress={() => setYearPickerOpen(false)} style={styles.modalCloseBtn}>
                <Icon name="close" size={18} color="#111" />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 320 }}>
              {availableYears.map((y) => (
                <TouchableOpacity
                  key={y}
                  style={[styles.pickItem, y === year && { backgroundColor: "rgba(50, 221, 121, 0.14)" }]}
                  onPress={() => {
                    setYear(y);
                    setYearPickerOpen(false);
                    setResultRows([]);
                  }}
                  activeOpacity={0.9}
                >
                  <Text style={[styles.pickText, y === year && { color: HERO_TEXT }]}>{y}</Text>
                  {y === year ? <Icon name="checkmark" size={18} color={HERO_TEXT} /> : null}
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ================= CANDIDATES LIST MODAL ================= */}
      <Modal visible={listOpen} animationType="slide" onRequestClose={() => setListOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "#fff" }}>
          <View style={styles.fullTop}>
            <TouchableOpacity onPress={() => setListOpen(false)} style={styles.fullBack} activeOpacity={0.9}>
              <Icon name="chevron-back" size={22} color="#111" />
            </TouchableOpacity>
            <View style={{ flex: 1 }}>
              <Text style={styles.fullTitle} numberOfLines={1}>
                {listTitle}
              </Text>
              <Text style={styles.fullSub} numberOfLines={1}>
                {t("jeunesse.ui.candidatesModal.sub")}
              </Text>
            </View>
          </View>

          <FlatList
            contentContainerStyle={{ padding: 16, paddingBottom: 30 }}
            data={listItems}
            keyExtractor={(it: any) => it.id}
            renderItem={({ item, index }) => (
              <View style={styles.fullRow}>
                <View style={styles.fullNum}>
                  <Text style={styles.fullNumText}>{index + 1}</Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.fullRowTitle} numberOfLines={1}>
                    {norm(item.firstName)} {norm(item.lastName)}
                  </Text>
                  <Text style={styles.fullRowSub} numberOfLines={1}>
                    {t("jeunesse.ui.misc.idLabel")}: {norm(item.identifier) || "—"} · {norm(item.country) || "—"} /{" "}
                    {norm(item.city) || "—"}
                  </Text>
                </View>
              </View>
            )}
          />
        </View>
      </Modal>

      {/* ================= QUIZ MODAL ================= */}
      <Modal visible={quizOpen} animationType="slide" onRequestClose={() => setQuizOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "#fff" }}>
          <View style={styles.fullTop}>
            <TouchableOpacity
              onPress={() => {
                if (timerRef.current) clearInterval(timerRef.current);
                timerRef.current = null;
                setQuizOpen(false);
              }}
              style={styles.fullBack}
              activeOpacity={0.9}
            >
              <Icon name="close" size={20} color="#111" />
            </TouchableOpacity>

            <View style={{ flex: 1 }}>
              <Text style={styles.fullTitle} numberOfLines={1}>
                {quizTitle}
              </Text>
              <Text style={[styles.fullSub, { color: "#ef4444" }]} numberOfLines={1}>
                {t("jeunesse.ui.quizModal.timeLeft", { sec: timeLeft })}
              </Text>
            </View>

            <View style={styles.badgeSoft}>
              <Text style={styles.badgeSoftText}>
                {quizIndex + 1}/{questions.length}
              </Text>
            </View>
          </View>

          {!currentQ ? (
            <View style={{ padding: 16 }}>
              <Text style={{ fontWeight: "800" }}>{t("jeunesse.ui.quizModal.noQuestion")}</Text>
            </View>
          ) : (
            <View style={{ padding: 16 }}>
              <View style={styles.qCard}>
                <Text style={styles.qTitle}>{currentQ.text}</Text>

                {(currentQ.options || []).map((op: string, idx: number) => {
                  const selected = quizAnswers[currentQ.id] === idx;
                  return (
                    <TouchableOpacity
                      key={idx}
                      onPress={() => chooseAnswer(currentQ.id, idx)}
                      style={[styles.optionRow, selected && styles.optionRowOn]}
                      activeOpacity={0.9}
                    >
                      <View style={[styles.optionDot, selected && styles.optionDotOn]}>
                        {selected ? <Icon name="checkmark" size={14} color={HERO_TEXT} /> : null}
                      </View>
                      <Text style={styles.optionText}>{op}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <View style={{ flexDirection: "row", gap: 10, marginTop: 12 }}>
                <TouchableOpacity
                  disabled={quizIndex === 0}
                  onPress={() => setQuizIndex((i) => Math.max(0, i - 1))}
                  style={[styles.navBtn, { opacity: quizIndex === 0 ? 0.45 : 1 }]}
                  activeOpacity={0.9}
                >
                  <Icon name="chevron-back" size={18} color="#111" />
                  <Text style={styles.navBtnText}>{t("jeunesse.ui.quizModal.prev")}</Text>
                </TouchableOpacity>

                {quizIndex < questions.length - 1 ? (
                  <TouchableOpacity
                    onPress={() => setQuizIndex((i) => Math.min(questions.length - 1, i + 1))}
                    style={[styles.navBtn, { backgroundColor: "#111827" }]}
                    activeOpacity={0.9}
                  >
                    <Text style={[styles.navBtnText, { color: "#fff" }]}>{t("jeunesse.ui.quizModal.next")}</Text>
                    <Icon name="chevron-forward" size={18} color="#fff" />
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity
                    onPress={() => submitQuiz(false)}
                    style={[styles.navBtn, { backgroundColor: "rgba(50, 221, 121, 0.7)" }]}
                    activeOpacity={0.9}
                  >
                    <Icon name="paper-plane-outline" size={18} color={HERO_TEXT} />
                    <Text style={[styles.navBtnText, { color: HERO_TEXT }]}>{t("jeunesse.ui.quizModal.submit")}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </View>
      </Modal>
    </View>
  );
}

/* ================= SMALL UI COMPONENTS ================= */
function TabsRow({ tab, setTab, compact }: { tab: TabKey; setTab: any; compact: boolean }) {
  const items = [
    { key: "home", icon: "home-outline", label: "Home" },
    { key: "results", icon: "ribbon-outline", label: "Results" },
    { key: "quiz", icon: "help-circle-outline", label: "Quiz" },
    { key: "register", icon: "person-add-outline", label: "Register" },
    { key: "history", icon: "time-outline", label: "History" },
  ] as const;

  if (compact) {
    return (
      <View style={hero.compactTabs}>
        {items.map((it) => {
          const active = tab === it.key;
          return (
            <TouchableOpacity
              key={it.key}
              onPress={() => setTab(it.key)}
              style={[hero.compactTabBtn, active && hero.compactTabBtnActive]}
              activeOpacity={0.9}
            >
              <Icon name={it.icon as any} size={20} color={active ? "#fff" : "rgba(6,51,37,0.55)"} />
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={hero.pillsRow}>
      {items.map((it) => {
        const active = tab === it.key;
        return (
          <TouchableOpacity
            key={it.key}
            onPress={() => setTab(it.key)}
            style={[hero.pill, active && hero.pillActive]}
            activeOpacity={0.9}
          >
            <Icon name={it.icon as any} size={16} color={active ? "#fff" : "rgba(2, 39, 27, 0.9)"} />
            <Text style={[hero.pillText, active && hero.pillTextActive]}>{it.label}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

function Field({ label, value, onChange, keyboardType }: any) {
  return (
    <View style={{ marginBottom: 12 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder="—"
        placeholderTextColor="#9CA3AF"
        keyboardType={keyboardType}
        style={styles.input}
      />
    </View>
  );
}

/* ================= HERO STYLES (MATCH HOME) ================= */
const hero = StyleSheet.create({
  heroContainer: {
    position: "absolute",
    left: 0,
    right: 0,
    top: 0,
    backgroundColor: HERO_BG,
    paddingTop: Platform.select({ ios: 54, android: 14 }),
    paddingHorizontal: 14,
    paddingBottom: 14,
    borderBottomLeftRadius: HERO_RADIUS,
    borderBottomRightRadius: HERO_RADIUS,
    overflow: "hidden",
    elevation: 4,
    zIndex: 10,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.06)",
  },

  heroPinnedTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },

  heroTopLeft: { flexDirection: "row", alignItems: "center", gap: 12, flex: 1 },
  heroTopRight: { flexDirection: "row", alignItems: "center", gap: 8 },

  heroIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: HERO_ICON_BG,
    alignItems: "center",
    justifyContent: "center",
  },

  heroTitle: { color: HERO_TEXT, fontSize: 20, fontWeight: "900" },
  heroSub: { marginTop: 4, color: "rgba(6, 51, 37, 0.65)", fontWeight: "800", fontSize: 12.5 },

  yearPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(245,245,245,1)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  yearPillText: { fontWeight: "900", color: HERO_TEXT },

  // Tabs (same as Home)
  pillsRow: { gap: 10, paddingRight: 14 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(110, 197, 129, 0.55)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
  },
  pillActive: {
    backgroundColor: "#111827",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  pillText: { fontWeight: "900", color: "rgba(2, 44, 31, 0.7)", fontSize: 12 },
  pillTextActive: { color: "#fff" },

  compactTabs: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 8,
    backgroundColor: "rgba(245,245,245,1)",
    borderRadius: 18,
    paddingVertical: 8,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  compactTabBtn: { flex: 1, height: 40, borderRadius: 14, alignItems: "center", justifyContent: "center" },
  compactTabBtnActive: { backgroundColor: "#111827" },

  // Expandable
  expandable: { marginTop: 12 },

  idRow: {
    marginTop: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    backgroundColor: "rgba(245,245,245,1)",
    borderRadius: 16,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  idInput: { flex: 1, color: HERO_TEXT, fontWeight: "900" },
  idBtn: {
    width: 40,
    height: 40,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },

  quickRow: { paddingTop: 10, gap: 10, paddingRight: 14 },
  quickPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "rgba(245,245,245,1)",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: "rgba(0,0,0,0.06)",
  },
  quickText: { fontWeight: "900", color: HERO_TEXT },
});

/* ================= STYLES (your original, kept) ================= */
const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: "#F4F5F7" },

  card: {
    backgroundColor: "#fff",
    borderRadius: 20,
    padding: 14,
    borderWidth: 1,
    borderColor: "#EEF0F3",
    shadowColor: "#000",
    shadowOpacity: 0.06,
    shadowRadius: 18,
    elevation: 2,
    marginBottom: 12,
  },
  cardHeader: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  cardTitle: { fontSize: 15.5, fontWeight: "900", color: "#111" },
  cardSub: { marginTop: 6, fontSize: 12.5, color: "#6B6B70", fontWeight: "700" },

  badgeSoft: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: 999, backgroundColor: "#F3F4F6" },
  badgeSoftText: { fontSize: 11, fontWeight: "900", color: "#111" },
  badgeSolid: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#111827",
  },
  badgeSolidText: { color: "#fff", fontWeight: "900", fontSize: 12 },

  phaseRow: {
    marginTop: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#EEF0F3",
    borderRadius: 16,
    padding: 12,
    backgroundColor: "#fff",
  },
  phaseIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  phaseName: { fontWeight: "900", color: "#111" },
  phaseSub: { marginTop: 4, fontSize: 12, fontWeight: "800", color: "#6B6B70" },
  smallIconBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },

  actionBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 16,
  },
  actionBtnText: { color: "#fff", fontWeight: "900" },

  centerMini: { paddingVertical: 16, alignItems: "center", justifyContent: "center" },
  helper: { marginTop: 8, fontWeight: "800", color: "#6B6B70" },

  emptyBlock: { padding: 18, alignItems: "center" },
  emptyTitle: { marginTop: 10, fontSize: 16, fontWeight: "900", color: "#111" },
  emptySub: { marginTop: 6, fontSize: 12.5, color: "#6B6B70", fontWeight: "700", textAlign: "center" },

  resultRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#EEF0F3",
    borderRadius: 16,
    padding: 12,
    marginTop: 10,
  },
  resultIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  resultTitle: { fontWeight: "900", color: "#111" },
  resultSub: { marginTop: 4, fontSize: 12, fontWeight: "800", color: "#6B6B70" },

  quizInfo: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#EEF0F3",
    borderRadius: 16,
    padding: 12,
  },
  quizIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  quizTitle: { fontWeight: "900", color: "#111" },
  quizSub: { marginTop: 4, fontSize: 12, fontWeight: "800", color: "#6B6B70" },

  primaryBtn: {
    marginTop: 12,
    backgroundColor: "#111827",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  primaryBtnText: { color: "#fff", fontWeight: "900" },

  secondaryBtn: {
    marginTop: 10,
    backgroundColor: "#F3F4F6",
    borderRadius: 16,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  secondaryBtnText: { color: "#111", fontWeight: "900" },

  label: { fontSize: 12, fontWeight: "900", color: "#111", marginBottom: 8 },
  input: {
    backgroundColor: "#F3F4F6",
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 14,
    fontSize: 14,
    fontWeight: "800",
    color: "#111",
  },
  divider: { height: 1, backgroundColor: "#EEF0F3", marginVertical: 14 },

  attemptRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#EEF0F3",
    borderRadius: 16,
    padding: 12,
    marginBottom: 10,
  },
  attemptIcon: { width: 44, height: 44, borderRadius: 14, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  attemptTitle: { fontWeight: "900", color: "#111" },
  attemptSub: { marginTop: 4, fontSize: 12, fontWeight: "800", color: "#6B6B70" },

  overlayCenter: { flex: 1, backgroundColor: "rgba(0,0,0,0.42)", justifyContent: "center" },
  pickerBox: { marginHorizontal: 14, backgroundColor: "#fff", borderRadius: 20, padding: 16, maxHeight: "80%" },
  modalHeader: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 10 },
  modalTitle: { fontSize: 18, fontWeight: "900", color: "#111" },
  modalSub: { marginTop: 4, fontSize: 12.5, fontWeight: "700", color: "#6B6B70" },
  modalCloseBtn: { width: 40, height: 40, borderRadius: 14, backgroundColor: "#F3F4F6", alignItems: "center", justifyContent: "center" },
  pickItem: {
    paddingVertical: 12,
    paddingHorizontal: 10,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pickText: { fontWeight: "900", color: "#111" },

  fullTop: {
    paddingTop: 12,
    paddingHorizontal: 14,
    paddingBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#EEF0F3",
  },
  fullBack: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  fullTitle: { fontSize: 16, fontWeight: "900", color: "#111" },
  fullSub: { marginTop: 3, fontSize: 12.5, fontWeight: "700", color: "#6B6B70" },

  fullRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderWidth: 1,
    borderColor: "#EEF0F3",
    borderRadius: 16,
    padding: 12,
    backgroundColor: "#fff",
    marginBottom: 10,
  },
  fullNum: { width: 34, height: 34, borderRadius: 12, backgroundColor: "rgba(50, 221, 121, 0.14)", alignItems: "center", justifyContent: "center" },
  fullNumText: { fontWeight: "900", color: HERO_TEXT },
  fullRowTitle: { fontWeight: "900", color: "#111" },
  fullRowSub: { marginTop: 4, fontSize: 12, fontWeight: "800", color: "#6B6B70" },

  qCard: {
    backgroundColor: "#fff",
    borderWidth: 1,
    borderColor: "#EEF0F3",
    borderRadius: 20,
    padding: 14,
  },
  qTitle: { fontSize: 15, fontWeight: "900", color: "#111", marginBottom: 12 },
  optionRow: {
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
  optionRowOn: {
    borderColor: "rgba(50, 221, 121, 0.38)",
    backgroundColor: "rgba(50, 221, 121, 0.10)",
  },
  optionDot: {
    width: 26,
    height: 26,
    borderRadius: 10,
    backgroundColor: "#F3F4F6",
    alignItems: "center",
    justifyContent: "center",
  },
  optionDotOn: { backgroundColor: "rgba(255,255,255,0.95)" },
  optionText: { fontWeight: "800", color: "#111", flex: 1 },

  navBtn: {
    flex: 1,
    backgroundColor: "#F3F4F6",
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  navBtnText: { fontWeight: "900", color: "#111" },
});
