// AdminJeunesse.tsx
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
  KeyboardAvoidingView,
  Platform,
  Alert,
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
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import useAdminEnglish from "../../../../src/hooks/useAdminEnglish";

type Tab = "children" | "concours" | "quiz";

const SETTINGS_DOC = "global"; // doc id inside jeunesse_settings

function genIdentifier() {
  // short readable code
  return (
    "J" +
    Date.now().toString(36).slice(-6).toUpperCase() +
    Math.random().toString(36).slice(2, 6).toUpperCase()
  );
}

export default function AdminJeunesse({ navigation }: any) {
  const { t } = useTranslation();
  useAdminEnglish();

  const [tab, setTab] = useState<Tab>("children");
  const [loading, setLoading] = useState(true);

  // ---------- Children ----------
  const [children, setChildren] = useState<any[]>([]);
  const [qText, setQText] = useState("");

  const [filtersOpen, setFiltersOpen] = useState(false);
  const [filters, setFilters] = useState({
    country: "",
    province: "",
    city: "",
    region: "",
    subRegion: "",
  });

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
  const [candidatesOpen, setCandidatesOpen] = useState(false);
  const [candidatePhase, setCandidatePhase] = useState<"prelim" | "preselection" | "selection" | "final">("prelim");

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

  const [candidateText, setCandidateText] = useState("");

  // ---------- Quiz ----------
  const [quizOpen, setQuizOpen] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState<any | null>(null);
  const [quizDraft, setQuizDraft] = useState({
    question: "",
    a: "",
    b: "",
    c: "",
    d: "",
    correct: "A",
    durationSec: "60",
    activeFrom: "",
    activeTo: "",
  });

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
    setChildren(snap.docs.map(d => ({ id: d.id, ...d.data() })));
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
    // simplest: fetch latest quiz doc (you can extend to "isActive==true")
    const snap = await getDocs(query(collection(db, "jeunesse_quizzes"), orderBy("createdAt", "desc")));
    const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    setActiveQuiz(list[0] || null);
  };

  // ---------- Filters + Search ----------
  const filteredChildren = useMemo(() => {
    const text = qText.trim().toLowerCase();
    let list = [...children];

    const f = filters;

    if (f.country.trim()) list = list.filter(c => String(c.country || "").toLowerCase().includes(f.country.trim().toLowerCase()));
    if (f.province.trim()) list = list.filter(c => String(c.province || "").toLowerCase().includes(f.province.trim().toLowerCase()));
    if (f.city.trim()) list = list.filter(c => String(c.city || "").toLowerCase().includes(f.city.trim().toLowerCase()));
    if (f.region.trim()) list = list.filter(c => String(c.region || "").toLowerCase().includes(f.region.trim().toLowerCase()));
    if (f.subRegion.trim()) list = list.filter(c => String(c.subRegion || "").toLowerCase().includes(f.subRegion.trim().toLowerCase()));

    if (text) {
      list = list.filter(c => {
        const full = `${c.firstName || ""} ${c.lastName || ""}`.toLowerCase();
        const id = String(c.identifier || "").toLowerCase();
        const parish = String(c.parishName || "").toLowerCase();
        return full.includes(text) || id.includes(text) || parish.includes(text);
      });
    }

    return list;
  }, [children, qText, filters]);

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
      firstName: String(c.firstName || ""),
      lastName: String(c.lastName || ""),
      age: String(c.age || ""),
      currentClass: String(c.currentClass || ""),
      academicYear: String(c.academicYear || ""),
      parishName: String(c.parishName || ""),
      parishShepherdNames: String(c.parishShepherdNames || ""),
      mainTeacherNames: String(c.mainTeacherNames || ""),
      shepherdPhone: String(c.shepherdPhone || ""),
      teacherPhone: String(c.teacherPhone || ""),
      contactEmail: String(c.contactEmail || ""),
      country: String(c.country || ""),
      province: String(c.province || ""),
      city: String(c.city || ""),
      region: String(c.region || ""),
      subRegion: String(c.subRegion || ""),
      identifier: String(c.identifier || genIdentifier()),
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
        }
      }
    ]);
  };

  // ---------- Concours settings ----------
  const openConcours = () => setConcoursOpen(true);

  const savePeriods = async () => {
    try {
      const ref = doc(db, "jeunesse_settings", SETTINGS_DOC);
      const year = periodDraft.year.trim() || String(new Date().getFullYear());

      const next = {
        years: {
          ...(settings?.years || {}),
          [year]: {
            periods: {
              prelim: { start: periodDraft.prelimStart.trim(), end: periodDraft.prelimEnd.trim() },
              preselection: { start: periodDraft.preselectionStart.trim(), end: periodDraft.preselectionEnd.trim() },
              selection: { start: periodDraft.selectionStart.trim(), end: periodDraft.selectionEnd.trim() },
              final: { start: periodDraft.finalStart.trim(), end: periodDraft.finalEnd.trim() },
            },
            candidates: (settings?.years || {})?.[year]?.candidates || {
              prelim: [],
              preselection: [],
              selection: [],
              final: [],
            },
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

  const openCandidates = (phase: any) => {
    const year = periodDraft.year.trim() || String(new Date().getFullYear());
    const y = (settings?.years || {})[year] || {};
    const list = (y?.candidates?.[phase] || []) as string[];
    setCandidatePhase(phase);
    setCandidateText(list.join("\n"));
    setCandidatesOpen(true);
  };

  const saveCandidates = async () => {
    try {
      const year = periodDraft.year.trim() || String(new Date().getFullYear());
      const lines = candidateText
        .split("\n")
        .map(s => s.trim())
        .filter(Boolean);

      const ref = doc(db, "jeunesse_settings", SETTINGS_DOC);
      const currentYears = settings?.years || {};
      const currentYear = currentYears[year] || {};
      const currentCandidates = currentYear?.candidates || { prelim: [], preselection: [], selection: [], final: [] };

      const next = {
        years: {
          ...currentYears,
          [year]: {
            ...currentYear,
            candidates: {
              ...currentCandidates,
              [candidatePhase]: lines,
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

  // ---------- Quiz ----------
  const openQuiz = () => {
    // prefill with current quiz if exists
    const q = activeQuiz || {};
    setQuizDraft({
      question: String(q.question || ""),
      a: String(q.options?.A || ""),
      b: String(q.options?.B || ""),
      c: String(q.options?.C || ""),
      d: String(q.options?.D || ""),
      correct: String(q.correct || "A"),
      durationSec: String(q.durationSec || "60"),
      activeFrom: String(q.activeFrom || ""),
      activeTo: String(q.activeTo || ""),
    });
    setQuizOpen(true);
  };

  const saveQuiz = async () => {
    if (!quizDraft.question.trim() || !quizDraft.a.trim() || !quizDraft.b.trim()) {
      Alert.alert(t("adminJeunesse.title"), t("adminJeunesse.children.required"));
      return;
    }
    try {
      const payload = {
        question: quizDraft.question.trim(),
        options: {
          A: quizDraft.a.trim(),
          B: quizDraft.b.trim(),
          C: quizDraft.c.trim(),
          D: quizDraft.d.trim(),
        },
        correct: String(quizDraft.correct || "A").toUpperCase(),
        durationSec: Number(quizDraft.durationSec || 60),
        activeFrom: quizDraft.activeFrom.trim(),
        activeTo: quizDraft.activeTo.trim(),
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
    if (tab === "concours") return t("adminJeunesse.concours.periodsHelp");
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
          <View style={styles.sectionCard}>
            <Text style={styles.sectionTitle}>{t("adminJeunesse.concours.title")}</Text>

            <Text style={styles.helperText}>
              {t("adminJeunesse.concours.year")}: {periodDraft.year}
            </Text>

            <View style={{ height: 12 }} />

            <ConcoursRow
              label={t("adminJeunesse.concours.prelim")}
              onPress={() => openCandidates("prelim")}
              period={{
                start: periodDraft.prelimStart,
                end: periodDraft.prelimEnd,
              }}
            />
            <ConcoursRow
              label={t("adminJeunesse.concours.preselection")}
              onPress={() => openCandidates("preselection")}
              period={{
                start: periodDraft.preselectionStart,
                end: periodDraft.preselectionEnd,
              }}
            />
            <ConcoursRow
              label={t("adminJeunesse.concours.selection")}
              onPress={() => openCandidates("selection")}
              period={{
                start: periodDraft.selectionStart,
                end: periodDraft.selectionEnd,
              }}
            />
            <ConcoursRow
              label={t("adminJeunesse.concours.final")}
              onPress={() => openCandidates("final")}
              period={{
                start: periodDraft.finalStart,
                end: periodDraft.finalEnd,
              }}
            />

            <TouchableOpacity style={[styles.primaryBtn, { marginTop: 14 }]} onPress={openConcours}>
              <Icon name="calendar-outline" size={16} color="#fff" />
              <Text style={styles.primaryText}>{t("adminJeunesse.concours.setPeriods")}</Text>
            </TouchableOpacity>
          </View>
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
                      {activeQuiz.question}
                    </Text>
                    <Text style={styles.roomSub} numberOfLines={1}>
                      {t("adminJeunesse.quiz.durationSec")}: {activeQuiz.durationSec || 60}s · {t("adminJeunesse.quiz.correct")}:
                      {" "}{activeQuiz.correct || "A"}
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

      {/* ---------------- FILTERS MODAL ---------------- */}
      <Modal visible={filtersOpen} transparent animationType="slide" onRequestClose={() => setFiltersOpen(false)}>
        <View style={styles.overlay}>
            <View style={styles.modal}>
              <View style={styles.modalHeader}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.modalTitle}>{t("common.filter")}</Text>
                  <Text style={styles.modalSub}>{t("adminJeunesse.children.location")}</Text>
                </View>
                <TouchableOpacity onPress={() => setFiltersOpen(false)} style={styles.modalCloseBtn}>
                  <Icon name="close" size={18} color="#111" />
                </TouchableOpacity>
              </View>

              <Field label={t("adminJeunesse.children.country")} value={filters.country} onChangeText={(v) => setFilters(s => ({ ...s, country: v }))} />
              <Field label={t("adminJeunesse.children.province")} value={filters.province} onChangeText={(v) => setFilters(s => ({ ...s, province: v }))} />
              <Field label={t("adminJeunesse.children.city")} value={filters.city} onChangeText={(v) => setFilters(s => ({ ...s, city: v }))} />
              <Field label={t("adminJeunesse.children.region")} value={filters.region} onChangeText={(v) => setFilters(s => ({ ...s, region: v }))} />
              <Field label={t("adminJeunesse.children.subRegion")} value={filters.subRegion} onChangeText={(v) => setFilters(s => ({ ...s, subRegion: v }))} />

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

              <TouchableOpacity style={styles.linkBtn} onPress={() => setFiltersOpen(false)}>
                <Text style={styles.linkText}>{t("common.close")}</Text>
              </TouchableOpacity>
            </View>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%" }}>
            
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ---------------- CHILD ADD/EDIT MODAL ---------------- */}
      <Modal visible={childModalOpen} transparent animationType="slide" onRequestClose={() => setChildModalOpen(false)}>
        <View style={styles.overlay}>
            <View style={styles.modal}>
              <ScrollView showsVerticalScrollIndicator={false}>
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
                  <TouchableOpacity
                    onPress={() => setChildDraft(s => ({ ...s, identifier: genIdentifier() }))}
                    style={styles.smallBtn}
                  >
                    <Icon name="refresh" size={16} color="#111" />
                    <Text style={styles.smallBtnText}>{t("adminJeunesse.children.generateId")}</Text>
                  </TouchableOpacity>
                </View>

                <Field label={t("adminJeunesse.children.firstName")} value={childDraft.firstName} onChangeText={(v) => setChildDraft(s => ({ ...s, firstName: v }))} />
                <Field label={t("adminJeunesse.children.lastName")} value={childDraft.lastName} onChangeText={(v) => setChildDraft(s => ({ ...s, lastName: v }))} />
                <Field label={t("adminJeunesse.children.age")} value={childDraft.age} onChangeText={(v) => setChildDraft(s => ({ ...s, age: v }))} placeholder="e.g. 10" keyboardType="numeric" />
                <Field label={t("adminJeunesse.children.class")} value={childDraft.currentClass} onChangeText={(v) => setChildDraft(s => ({ ...s, currentClass: v }))} />
                <Field label={t("adminJeunesse.children.academicYear")} value={childDraft.academicYear} onChangeText={(v) => setChildDraft(s => ({ ...s, academicYear: v }))} placeholder="2024-2025" />

                <View style={styles.divider} />

                <Field label={t("adminJeunesse.children.parish")} value={childDraft.parishName} onChangeText={(v) => setChildDraft(s => ({ ...s, parishName: v }))} />
                <Field label={t("adminJeunesse.children.shepherd")} value={childDraft.parishShepherdNames} onChangeText={(v) => setChildDraft(s => ({ ...s, parishShepherdNames: v }))} />
                <Field label={t("adminJeunesse.children.teacher")} value={childDraft.mainTeacherNames} onChangeText={(v) => setChildDraft(s => ({ ...s, mainTeacherNames: v }))} />
                <Field label={`${t("adminJeunesse.children.phones")} (shepherd)`} value={childDraft.shepherdPhone} onChangeText={(v) => setChildDraft(s => ({ ...s, shepherdPhone: v }))} />
                <Field label={`${t("adminJeunesse.children.phones")} (teacher)`} value={childDraft.teacherPhone} onChangeText={(v) => setChildDraft(s => ({ ...s, teacherPhone: v }))} />
                <Field label={t("adminJeunesse.children.email")} value={childDraft.contactEmail} onChangeText={(v) => setChildDraft(s => ({ ...s, contactEmail: v }))} />

                <View style={styles.divider} />

                <Field label={t("adminJeunesse.children.country")} value={childDraft.country} onChangeText={(v) => setChildDraft(s => ({ ...s, country: v }))} />
                <Field label={t("adminJeunesse.children.province")} value={childDraft.province} onChangeText={(v) => setChildDraft(s => ({ ...s, province: v }))} />
                <Field label={t("adminJeunesse.children.city")} value={childDraft.city} onChangeText={(v) => setChildDraft(s => ({ ...s, city: v }))} />
                <Field label={t("adminJeunesse.children.region")} value={childDraft.region} onChangeText={(v) => setChildDraft(s => ({ ...s, region: v }))} />
                <Field label={t("adminJeunesse.children.subRegion")} value={childDraft.subRegion} onChangeText={(v) => setChildDraft(s => ({ ...s, subRegion: v }))} />

                <TouchableOpacity style={styles.primaryBtn} onPress={saveChild}>
                  <Icon name="save-outline" size={16} color="#fff" />
                  <Text style={styles.primaryText}>{t("common.save")}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.linkBtn} onPress={() => setChildModalOpen(false)}>
                  <Text style={styles.linkText}>{t("common.close")}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%" }}>
            
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ---------------- CONCOURS PERIOD MODAL ---------------- */}
      <Modal visible={concoursOpen} transparent animationType="slide" onRequestClose={() => setConcoursOpen(false)}>
        <View style={styles.overlay}>
            <View style={styles.modal}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle}>{t("adminJeunesse.concours.setPeriods")}</Text>
                    <Text style={styles.modalSub}>{t("adminJeunesse.concours.periodsHelp")}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setConcoursOpen(false)} style={styles.modalCloseBtn}>
                    <Icon name="close" size={18} color="#111" />
                  </TouchableOpacity>
                </View>

                <Field label={t("adminJeunesse.concours.year")} value={periodDraft.year} onChangeText={(v) => setPeriodDraft(s => ({ ...s, year: v }))} placeholder="2024" />

                <Text style={styles.sectionTitle}>{t("adminJeunesse.concours.prelim")}</Text>
                <Field label={t("adminJeunesse.concours.start")} value={periodDraft.prelimStart} onChangeText={(v) => setPeriodDraft(s => ({ ...s, prelimStart: v }))} />
                <Field label={t("adminJeunesse.concours.end")} value={periodDraft.prelimEnd} onChangeText={(v) => setPeriodDraft(s => ({ ...s, prelimEnd: v }))} />

                <Text style={styles.sectionTitle}>{t("adminJeunesse.concours.preselection")}</Text>
                <Field label={t("adminJeunesse.concours.start")} value={periodDraft.preselectionStart} onChangeText={(v) => setPeriodDraft(s => ({ ...s, preselectionStart: v }))} />
                <Field label={t("adminJeunesse.concours.end")} value={periodDraft.preselectionEnd} onChangeText={(v) => setPeriodDraft(s => ({ ...s, preselectionEnd: v }))} />

                <Text style={styles.sectionTitle}>{t("adminJeunesse.concours.selection")}</Text>
                <Field label={t("adminJeunesse.concours.start")} value={periodDraft.selectionStart} onChangeText={(v) => setPeriodDraft(s => ({ ...s, selectionStart: v }))} />
                <Field label={t("adminJeunesse.concours.end")} value={periodDraft.selectionEnd} onChangeText={(v) => setPeriodDraft(s => ({ ...s, selectionEnd: v }))} />

                <Text style={styles.sectionTitle}>{t("adminJeunesse.concours.final")}</Text>
                <Field label={t("adminJeunesse.concours.start")} value={periodDraft.finalStart} onChangeText={(v) => setPeriodDraft(s => ({ ...s, finalStart: v }))} />
                <Field label={t("adminJeunesse.concours.end")} value={periodDraft.finalEnd} onChangeText={(v) => setPeriodDraft(s => ({ ...s, finalEnd: v }))} />

                <TouchableOpacity style={styles.primaryBtn} onPress={savePeriods}>
                  <Icon name="save-outline" size={16} color="#fff" />
                  <Text style={styles.primaryText}>{t("common.save")}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.linkBtn} onPress={() => setConcoursOpen(false)}>
                  <Text style={styles.linkText}>{t("common.close")}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%" }}>
            
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ---------------- CANDIDATES MODAL ---------------- */}
      <Modal visible={candidatesOpen} transparent animationType="slide" onRequestClose={() => setCandidatesOpen(false)}>
        <View style={styles.overlay}>
             <View style={styles.modal}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle}>
                      {t("adminJeunesse.concours.candidates")} · {t(`adminJeunesse.concours.${candidatePhase === "prelim" ? "prelim" : candidatePhase}`)}
                    </Text>
                    <Text style={styles.modalSub}>{t("adminJeunesse.concours.pasteHelp")}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setCandidatesOpen(false)} style={styles.modalCloseBtn}>
                    <Icon name="close" size={18} color="#111" />
                  </TouchableOpacity>
                </View>

                <Text style={styles.label}>{t("adminJeunesse.concours.candidates")}</Text>
                <TextInput
                  value={candidateText}
                  onChangeText={setCandidateText}
                  placeholder="John Doe\nJane Doe\n..."
                  placeholderTextColor="#9CA3AF"
                  style={[styles.input, { minHeight: 220, textAlignVertical: "top" }]}
                  multiline
                />

                <TouchableOpacity style={styles.primaryBtn} onPress={saveCandidates}>
                  <Icon name="save-outline" size={16} color="#fff" />
                  <Text style={styles.primaryText}>{t("common.save")}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.linkBtn} onPress={() => setCandidatesOpen(false)}>
                  <Text style={styles.linkText}>{t("common.close")}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%" }}>
           
          </KeyboardAvoidingView>
        </View>
      </Modal>

      {/* ---------------- QUIZ MODAL ---------------- */}
      <Modal visible={quizOpen} transparent animationType="slide" onRequestClose={() => setQuizOpen(false)}>
        <View style={styles.overlay}>
             <View style={styles.modal}>
              <ScrollView showsVerticalScrollIndicator={false}>
                <View style={styles.modalHeader}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalTitle}>{t("adminJeunesse.quiz.manage")}</Text>
                    <Text style={styles.modalSub}>{t("adminJeunesse.quiz.title")}</Text>
                  </View>
                  <TouchableOpacity onPress={() => setQuizOpen(false)} style={styles.modalCloseBtn}>
                    <Icon name="close" size={18} color="#111" />
                  </TouchableOpacity>
                </View>

                <Field label={t("adminJeunesse.quiz.question")} value={quizDraft.question} onChangeText={(v) => setQuizDraft(s => ({ ...s, question: v }))} />

                <Text style={styles.sectionTitle}>Options</Text>
                <Field label={t("adminJeunesse.quiz.optionA")} value={quizDraft.a} onChangeText={(v) => setQuizDraft(s => ({ ...s, a: v }))} />
                <Field label={t("adminJeunesse.quiz.optionB")} value={quizDraft.b} onChangeText={(v) => setQuizDraft(s => ({ ...s, b: v }))} />
                <Field label={t("adminJeunesse.quiz.optionC")} value={quizDraft.c} onChangeText={(v) => setQuizDraft(s => ({ ...s, c: v }))} />
                <Field label={t("adminJeunesse.quiz.optionD")} value={quizDraft.d} onChangeText={(v) => setQuizDraft(s => ({ ...s, d: v }))} />

                <View style={styles.twoBtns}>
                  <FieldInline
                    label={t("adminJeunesse.quiz.correct")}
                    value={quizDraft.correct}
                    onChangeText={(v: any) => setQuizDraft(s => ({ ...s, correct: v }))}
                    placeholder="A"
                  />
                  <FieldInline
                    label={t("adminJeunesse.quiz.durationSec")}
                    value={quizDraft.durationSec}
                    onChangeText={(v: any) => setQuizDraft(s => ({ ...s, durationSec: v }))}
                    placeholder="60"
                    keyboardType="numeric"
                  />
                </View>

                <Field label={t("adminJeunesse.quiz.activeFrom")} value={quizDraft.activeFrom} onChangeText={(v) => setQuizDraft(s => ({ ...s, activeFrom: v }))} />
                <Field label={t("adminJeunesse.quiz.activeTo")} value={quizDraft.activeTo} onChangeText={(v) => setQuizDraft(s => ({ ...s, activeTo: v }))} />

                <TouchableOpacity style={styles.primaryBtn} onPress={saveQuiz}>
                  <Icon name="save-outline" size={16} color="#fff" />
                  <Text style={styles.primaryText}>{t("common.save")}</Text>
                </TouchableOpacity>

                <TouchableOpacity style={styles.linkBtn} onPress={() => setQuizOpen(false)}>
                  <Text style={styles.linkText}>{t("common.close")}</Text>
                </TouchableOpacity>
              </ScrollView>
            </View>
          <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={{ width: "100%" }}>
           
          </KeyboardAvoidingView>
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

function ConcoursRow({
  label,
  onPress,
  period,
}: {
  label: string;
  onPress: () => void;
  period: { start: string; end: string };
}) {
  return (
    <View style={styles.roomRow}>
      <View style={styles.roomIcon}>
        <Icon name="trophy-outline" size={18} color="#111" />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.roomName} numberOfLines={1}>{label}</Text>
        <Text style={styles.roomSub} numberOfLines={1}>
          {period.start || "—"} → {period.end || "—"}
        </Text>
      </View>
      <TouchableOpacity onPress={onPress} style={styles.smallIconBtn} activeOpacity={0.9}>
        <Icon name="list-outline" size={18} color="#111" />
      </TouchableOpacity>
    </View>
  );
}

/* ================= STYLES (same language as AdminUsers) ================= */
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
  modal: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 18,
    maxHeight: "92%",
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
    marginTop: 6,
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

  linkBtn: { alignItems: "center", marginTop: 14, paddingVertical: 8 },
  linkText: { color: COLORS.light.primary, fontWeight: "900" },

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
});
