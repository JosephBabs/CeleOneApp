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
} from "react-native";
import { useTranslation } from "react-i18next";
import { auth, db } from "../auth/firebaseConfig";
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";

function normName(s: string) {
  return String(s || "")
    .trim()
    .replace(/\s+/g, " ")
    .toUpperCase();
}

function makeIdentifier(year: string) {
  const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
  return `AJ-${year}-${rand}`;
}

type PhaseKey = "preselection" | "selection" | "final";

export default function Jeunesse() {
  const { t } = useTranslation();

  const [loading, setLoading] = useState(false);

  // Modal for shortlist viewing
  const [listOpen, setListOpen] = useState(false);
  const [listTitle, setListTitle] = useState("");
  const [listItems, setListItems] = useState<{ original: string; name: string }[]>([]);

  // Results checking
  const [identifier, setIdentifier] = useState("");
  const [resultMatches, setResultMatches] = useState<{ phaseKey: PhaseKey; title: string }[]>([]);
  const [checking, setChecking] = useState(false);

  // Registration
  const [reg, setReg] = useState({
    firstName: "",
    lastName: "",
    age: "",
    currentClass: "",
    academicYear: "",
    parishName: "",
    shepherdNames: "",
    teacherNames: "",
    shepherdPhone: "",
    teacherPhone: "",
    email: "",
    country: "",
    province: "",
    city: "",
    region: "",
    subRegion: "",
  });

  // Quiz
  const [activeQuiz, setActiveQuiz] = useState<any | null>(null);
  const [quizLoading, setQuizLoading] = useState(false);
  const [quizOpen, setQuizOpen] = useState(false);
  const [quizIndex, setQuizIndex] = useState(0);
  const [quizAnswers, setQuizAnswers] = useState<Record<string, number>>({});
  const [timeLeft, setTimeLeft] = useState(0);
  const timerRef = useRef<any>(null);

  const currentYear = useMemo(() => String(new Date().getFullYear()), []);

  // Load active quiz
  useEffect(() => {
    const load = async () => {
      setQuizLoading(true);
      try {
        const qy = query(
          collection(db, "jeunesse_quizzes"),
          where("isActive", "==", true),
          orderBy("createdAt", "desc"),
          limit(1)
        );
        const snap = await getDocs(qy);
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
    load();
  }, []);

  const openPhaseList = async (year: string, phaseKey: PhaseKey) => {
    setLoading(true);
    try {
      const ref = doc(db, "jeunesse_concours", year, "phases", phaseKey);
      const snap = await getDoc(ref);
      const data: any = snap.exists() ? snap.data() : null;
      const title =
        data?.title ||
        (phaseKey === "preselection"
          ? t("jeunesse.preselection")
          : phaseKey === "selection"
          ? t("jeunesse.selection")
          : t("jeunesse.final"));

      const candidates = Array.isArray(data?.candidates) ? data.candidates : [];

      setListTitle(title);
      setListItems(candidates);
      setListOpen(true);
    } catch (e: any) {
      Alert.alert(t("jeunesse.results"), e?.message || "Error");
    } finally {
      setLoading(false);
    }
  };

  const registerChild = async () => {
    const required = ["firstName", "lastName", "age", "currentClass", "academicYear", "parishName", "email", "country", "city"];
    for (const k of required) {
      // @ts-ignore
      if (!String(reg[k] || "").trim()) {
        Alert.alert(t("jeunesse.registerChild"), `${t("jeunesse.submit")} - ${t("jeunesse.saveFailed")}`);
        return;
      }
    }

    setLoading(true);
    try {
      const year = String(reg.academicYear || currentYear).slice(0, 4) || currentYear;
      const idf = makeIdentifier(year);

      const payload = {
        identifier: idf,
        firstName: reg.firstName.trim(),
        lastName: reg.lastName.trim(),
        age: Number(reg.age || 0),
        currentClass: reg.currentClass.trim(),
        academicYear: reg.academicYear.trim(),
        parish: {
          name: reg.parishName.trim(),
          shepherdNames: reg.shepherdNames.trim(),
          teacherNames: reg.teacherNames.trim(),
          shepherdPhone: reg.shepherdPhone.trim(),
          teacherPhone: reg.teacherPhone.trim(),
          email: reg.email.trim(),
          country: reg.country.trim(),
          province: reg.province.trim(),
          city: reg.city.trim(),
          region: reg.region.trim(),
          subRegion: reg.subRegion.trim(),
        },
        createdAt: Date.now(),
      };

      await addDoc(collection(db, "jeunesse_children"), payload);

      Alert.alert(t("jeunesse.saved"), `${t("jeunesse.identifier")}: ${idf}`);
      setReg({
        firstName: "",
        lastName: "",
        age: "",
        currentClass: "",
        academicYear: "",
        parishName: "",
        shepherdNames: "",
        teacherNames: "",
        shepherdPhone: "",
        teacherPhone: "",
        email: "",
        country: "",
        province: "",
        city: "",
        region: "",
        subRegion: "",
      });
    } catch (e: any) {
      Alert.alert(t("jeunesse.saveFailed"), e?.message || "Error");
    } finally {
      setLoading(false);
    }
  };

  const checkResultsByIdentifier = async () => {
    const idf = identifier.trim();
    if (!idf) return;

    setChecking(true);
    setResultMatches([]);
    try {
      // find child
      const qy = query(collection(db, "jeunesse_children"), where("identifier", "==", idf), limit(1));
      const cs = await getDocs(qy);
      if (cs.empty) {
        Alert.alert(t("jeunesse.results"), t("jeunesse.noResults"));
        return;
      }

      const child = cs.docs[0].data() as any;
      const fullName = normName(`${child.firstName} ${child.lastName}`);

      // check across concours phases for year 2024 (your requirement)
      const year = "2024";
      const phases: PhaseKey[] = ["preselection", "selection", "final"];

      const matches: { phaseKey: PhaseKey; title: string }[] = [];

      for (const pk of phases) {
        const ref = doc(db, "jeunesse_concours", year, "phases", pk);
        const snap = await getDoc(ref);
        if (!snap.exists()) continue;
        const data: any = snap.data();
        const candidates: any[] = Array.isArray(data.candidates) ? data.candidates : [];

        const found = candidates.some(c => normName(c?.name || "") === fullName);
        if (found) {
          matches.push({
            phaseKey: pk,
            title: data?.title || (pk === "preselection" ? t("jeunesse.preselection") : pk === "selection" ? t("jeunesse.selection") : t("jeunesse.final")),
          });
        }
      }

      if (matches.length === 0) {
        Alert.alert(t("jeunesse.results"), t("jeunesse.noResults"));
      }
      setResultMatches(matches);
    } catch (e: any) {
      Alert.alert(t("jeunesse.results"), e?.message || "Error");
    } finally {
      setChecking(false);
    }
  };

  const startQuiz = async () => {
    if (!activeQuiz) {
      Alert.alert(t("jeunesse.weeklyQuiz"), t("jeunesse.quizNotAvailable"));
      return;
    }

    // require identifier to link attempt to child
    if (!identifier.trim()) {
      Alert.alert(t("jeunesse.identifier"), t("jeunesse.enterIdentifier"));
      return;
    }

    setQuizLoading(true);
    try {
      // ensure quiz not played already for this identifier
      const qy = query(
        collection(db, "jeunesse_quiz_attempts"),
        where("quizId", "==", activeQuiz.id),
        where("identifier", "==", identifier.trim()),
        limit(1)
      );
      const snap = await getDocs(qy);
      if (!snap.empty) {
        Alert.alert(t("jeunesse.weeklyQuiz"), t("jeunesse.alreadyPlayed"));
        return;
      }

      setQuizAnswers({});
      setQuizIndex(0);
      setTimeLeft(Number(activeQuiz.durationSec || 60));
      setQuizOpen(true);

      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        setTimeLeft((s) => {
          if (s <= 1) {
            clearInterval(timerRef.current);
            timerRef.current = null;
            // auto submit
            setTimeout(() => submitQuiz(true), 80);
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } finally {
      setQuizLoading(false);
    }
  };

  const chooseAnswer = (qid: string, index: number) => {
    setQuizAnswers(prev => ({ ...prev, [qid]: index }));
  };

  const submitQuiz = async (auto = false) => {
    if (!activeQuiz) return;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    const questions = Array.isArray(activeQuiz.questions) ? activeQuiz.questions : [];
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
        durationSec: Number(activeQuiz.durationSec || 60),
        startedAt: Date.now() - (Number(activeQuiz.durationSec || 60) - timeLeft) * 1000,
        submittedAt: Date.now(),
        autoSubmitted: !!auto
      });

      Alert.alert(t("jeunesse.weeklyQuiz"), t("jeunesse.score", { score, total: questions.length }));
    } catch (e: any) {
      Alert.alert(t("jeunesse.weeklyQuiz"), e?.message || "Error");
    } finally {
      setQuizOpen(false);
    }
  };

  useEffect(() => {
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, []);

  const questions = Array.isArray(activeQuiz?.questions) ? activeQuiz.questions : [];
  const currentQ = questions[quizIndex];

  return (
    <ScrollView style={{ flex: 1, padding: 16, backgroundColor: "#fff" }} contentContainerStyle={{ paddingBottom: 40 }}>
      <Text style={{ fontSize: 22, fontWeight: "800", marginBottom: 6 }}>{t("jeunesse.title")}</Text>
      <Text style={{ color: "#334155", marginBottom: 12 }}>{t("jeunesse.childrenAndYouth")}</Text>
      <Text style={{ color: "#0f172a", marginBottom: 16, fontWeight: "600" }}>{t("jeunesse.amisDeJesus")}</Text>

      {/* Concours phases */}
      <View style={{ borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 14, padding: 12, marginBottom: 14 }}>
        <Text style={{ fontWeight: "800", marginBottom: 10 }}>{t("jeunesse.openPhases")}</Text>

        <View style={{ flexDirection: "row", gap: 10, flexWrap: "wrap" }}>
          <TouchableOpacity onPress={() => openPhaseList("2024", "preselection")} style={btn()}>
            <Text style={btnText()}>{t("jeunesse.preselection")}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => openPhaseList("2024", "selection")} style={btn()}>
            <Text style={btnText()}>{t("jeunesse.selection")}</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => openPhaseList("2024", "final")} style={btn()}>
            <Text style={btnText()}>{t("jeunesse.final")}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Check results */}
      <View style={{ borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 14, padding: 12, marginBottom: 14 }}>
        <Text style={{ fontWeight: "800", marginBottom: 10 }}>{t("jeunesse.checkResults")}</Text>

        <Text style={{ marginBottom: 6 }}>{t("jeunesse.identifier")}</Text>
        <TextInput
          value={identifier}
          onChangeText={setIdentifier}
          placeholder={t("jeunesse.enterIdentifier")}
          style={inputStyle()}
        />

        <TouchableOpacity onPress={checkResultsByIdentifier} style={[btn({ marginTop: 10 }), { backgroundColor: "#2FA5A9" }]}>
          {checking ? <ActivityIndicator color="#fff" /> : <Text style={[btnText(), { color: "#fff" }]}>{t("jeunesse.search")}</Text>}
        </TouchableOpacity>

        {resultMatches.length > 0 ? (
          <View style={{ marginTop: 10 }}>
            <Text style={{ fontWeight: "800", marginBottom: 6 }}>{t("jeunesse.results")}</Text>
            {resultMatches.map((m, idx) => (
              <Text key={idx} style={{ color: "#0f172a" }}>• {m.title}</Text>
            ))}
          </View>
        ) : null}
      </View>

      {/* Weekly Quiz */}
      <View style={{ borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 14, padding: 12, marginBottom: 14 }}>
        <Text style={{ fontWeight: "800", marginBottom: 10 }}>{t("jeunesse.weeklyQuiz")}</Text>
        {quizLoading ? (
          <ActivityIndicator />
        ) : (
          <>
            <Text style={{ color: "#334155", marginBottom: 10 }}>{activeQuiz?.title || t("jeunesse.quizNotAvailable")}</Text>
            <TouchableOpacity onPress={startQuiz} style={[btn(), { backgroundColor: "#111827" }]}>
              <Text style={[btnText(), { color: "#fff" }]}>{t("jeunesse.startQuiz")}</Text>
            </TouchableOpacity>
          </>
        )}
      </View>

      {/* Registration */}
      <View style={{ borderWidth: 1, borderColor: "#e2e8f0", borderRadius: 14, padding: 12 }}>
        <Text style={{ fontWeight: "800", marginBottom: 10 }}>{t("jeunesse.registerChild")}</Text>

        {field(t("jeunesse.firstName"), reg.firstName, (v) => setReg(p => ({ ...p, firstName: v })))}
        {field(t("jeunesse.lastName"), reg.lastName, (v) => setReg(p => ({ ...p, lastName: v })))}
        {field(t("jeunesse.age"), reg.age, (v) => setReg(p => ({ ...p, age: v })), "numeric")}
        {field(t("jeunesse.currentClass"), reg.currentClass, (v) => setReg(p => ({ ...p, currentClass: v })))}
        {field(t("jeunesse.academicYear"), reg.academicYear, (v) => setReg(p => ({ ...p, academicYear: v })))}

        {field(t("jeunesse.parishName"), reg.parishName, (v) => setReg(p => ({ ...p, parishName: v })))}
        {field(t("jeunesse.shepherdNames"), reg.shepherdNames, (v) => setReg(p => ({ ...p, shepherdNames: v })))}
        {field(t("jeunesse.teacherNames"), reg.teacherNames, (v) => setReg(p => ({ ...p, teacherNames: v })))}
        {field(t("jeunesse.shepherdPhone"), reg.shepherdPhone, (v) => setReg(p => ({ ...p, shepherdPhone: v })))}
        {field(t("jeunesse.teacherPhone"), reg.teacherPhone, (v) => setReg(p => ({ ...p, teacherPhone: v })))}
        {field(t("jeunesse.email"), reg.email, (v) => setReg(p => ({ ...p, email: v })))}

        {field(t("jeunesse.country"), reg.country, (v) => setReg(p => ({ ...p, country: v })))}
        {field(t("jeunesse.province"), reg.province, (v) => setReg(p => ({ ...p, province: v })))}
        {field(t("jeunesse.city"), reg.city, (v) => setReg(p => ({ ...p, city: v })))}
        {field(t("jeunesse.region"), reg.region, (v) => setReg(p => ({ ...p, region: v })))}
        {field(t("jeunesse.subRegion"), reg.subRegion, (v) => setReg(p => ({ ...p, subRegion: v })))}

        <TouchableOpacity onPress={registerChild} style={[btn({ marginTop: 10 }), { backgroundColor: "#2FA5A9" }]}>
          {loading ? <ActivityIndicator color="#fff" /> : <Text style={[btnText(), { color: "#fff" }]}>{t("jeunesse.submit")}</Text>}
        </TouchableOpacity>
      </View>

      {/* Full page shortlist modal */}
      <Modal visible={listOpen} animationType="slide" onRequestClose={() => setListOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "#fff", padding: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: "900", marginBottom: 8 }}>{listTitle}</Text>
          <Text style={{ color: "#334155", marginBottom: 12 }}>{t("jeunesse.shortlisted")}</Text>

          <FlatList
            data={listItems}
            keyExtractor={(it, idx) => it.name + idx}
            renderItem={({ item, index }) => (
              <View style={{ paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: "#f1f5f9" }}>
                <Text style={{ fontWeight: "800" }}>{index + 1}. {item.original}</Text>
              </View>
            )}
          />

          <TouchableOpacity onPress={() => setListOpen(false)} style={[btn({ marginTop: 12 }), { backgroundColor: "#111827" }]}>
            <Text style={[btnText(), { color: "#fff" }]}>{t("jeunesse.close")}</Text>
          </TouchableOpacity>
        </View>
      </Modal>

      {/* Quiz modal */}
      <Modal visible={quizOpen} animationType="slide" onRequestClose={() => setQuizOpen(false)}>
        <View style={{ flex: 1, backgroundColor: "#fff", padding: 16 }}>
          <Text style={{ fontSize: 18, fontWeight: "900" }}>{activeQuiz?.title || t("jeunesse.weeklyQuiz")}</Text>
          <Text style={{ marginTop: 8, color: "#ef4444", fontWeight: "800" }}>
            {t("jeunesse.timeLeft", { sec: timeLeft })}
          </Text>

          {!currentQ ? (
            <View style={{ marginTop: 20 }}>
              <Text>{t("jeunesse.quizNotAvailable")}</Text>
            </View>
          ) : (
            <View style={{ marginTop: 18 }}>
              <Text style={{ fontWeight: "900", marginBottom: 10 }}>
                {quizIndex + 1}/{questions.length} — {currentQ.text}
              </Text>

              {(currentQ.options || []).map((op: string, idx: number) => {
                const selected = quizAnswers[currentQ.id] === idx;
                return (
                  <TouchableOpacity
                    key={idx}
                    onPress={() => chooseAnswer(currentQ.id, idx)}
                    style={{
                      padding: 12,
                      borderRadius: 12,
                      borderWidth: 1,
                      borderColor: selected ? "#2FA5A9" : "#e2e8f0",
                      backgroundColor: selected ? "rgba(47,165,169,0.08)" : "#fff",
                      marginBottom: 10,
                    }}
                  >
                    <Text style={{ fontWeight: "700" }}>{op}</Text>
                  </TouchableOpacity>
                );
              })}

              <View style={{ flexDirection: "row", gap: 10, marginTop: 10 }}>
                <TouchableOpacity
                  disabled={quizIndex === 0}
                  onPress={() => setQuizIndex(i => Math.max(0, i - 1))}
                  style={[btn({ flex: 1 }), { opacity: quizIndex === 0 ? 0.5 : 1 }]}
                >
                  <Text style={btnText()}>Prev</Text>
                </TouchableOpacity>

                {quizIndex < questions.length - 1 ? (
                  <TouchableOpacity onPress={() => setQuizIndex(i => Math.min(questions.length - 1, i + 1))} style={[btn({ flex: 1 }), { backgroundColor: "#111827" }]}>
                    <Text style={[btnText(), { color: "#fff" }]}>Next</Text>
                  </TouchableOpacity>
                ) : (
                  <TouchableOpacity onPress={() => submitQuiz(false)} style={[btn({ flex: 1 }), { backgroundColor: "#2FA5A9" }]}>
                    <Text style={[btnText(), { color: "#fff" }]}>{t("jeunesse.submitQuiz")}</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          )}
        </View>
      </Modal>
    </ScrollView>
  );
}

function btn(extra: any = {}) {
  return {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: "#f1f5f9",
    alignItems: "center",
    justifyContent: "center",
    ...extra,
  };
}
function btnText() {
  return { fontWeight: "900", color: "#0f172a" };
}
function inputStyle() {
  return {
    borderWidth: 1,
    borderColor: "#e2e8f0",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: "#fff",
  } as const;
}
function field(label: string, value: string, onChange: (v: string) => void, keyboardType?: any) {
  return (
    <View style={{ marginBottom: 10 }}>
      <Text style={{ marginBottom: 6, fontWeight: "700" }}>{label}</Text>
      <TextInput value={value} onChangeText={onChange} keyboardType={keyboardType} style={inputStyle()} />
    </View>
  );
}
