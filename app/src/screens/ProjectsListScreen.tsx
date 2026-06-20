// Projects home: a list of projects (newest first). A project bundles an overall goal +
// standing context that every chat created inside it inherits. Tap a project to open its
// detail (edit context, see/start its chats). A floating ＋ creates a new project.
import { useCallback, useMemo, useState } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import type { RootStackParamList } from '../navigation/types';
import { createProject, deleteProject, listProjects } from '../storage/db';
import { useTheme } from '../state/ThemeContext';
import { ClaudeMascot } from '../components/ClaudeMascot';
import { radius, spacing, type Colors } from '../theme';
import type { Project } from '../storage/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Projects'>;

export function ProjectsListScreen({ navigation }: Props) {
  const { colors } = useTheme();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);

  const refresh = useCallback(async () => {
    setProjects(await listProjects());
    setLoading(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh]),
  );

  const newProject = useCallback(async () => {
    const p = await createProject();
    navigation.navigate('ProjectDetail', { projectId: p.id, title: p.title });
  }, [navigation]);

  const confirmDelete = useCallback(
    (p: Project) =>
      Alert.alert(
        'Delete project?',
        `“${p.title}” will be deleted. Its chats are kept but moved out of the project.`,
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Delete',
            style: 'destructive',
            onPress: async () => {
              await deleteProject(p.id);
              await refresh();
            },
          },
        ],
      ),
    [refresh],
  );

  useFocusEffect(
    useCallback(() => {
      navigation.setOptions({
        headerRight: () =>
          projects.length > 0 ? (
            <TouchableOpacity onPress={() => setEditing((e) => !e)} hitSlop={10}>
              <Text style={styles.headerBtn}>{editing ? 'Done' : 'Edit'}</Text>
            </TouchableOpacity>
          ) : null,
      });
    }, [navigation, editing, projects.length, styles]),
  );

  return (
    <SafeAreaView style={styles.screen} edges={['left', 'right', 'bottom']}>
      <FlatList
        data={projects}
        keyExtractor={(p) => p.id}
        contentContainerStyle={projects.length === 0 ? styles.emptyWrap : styles.list}
        renderItem={({ item }) => (
          <View style={styles.row}>
            <Pressable
              style={styles.rowMain}
              onPress={() => navigation.navigate('ProjectDetail', { projectId: item.id, title: item.title })}
            >
              <Text style={styles.rowTitle} numberOfLines={1}>
                📁 {item.title}
              </Text>
              {item.goal ? (
                <Text style={styles.rowSub} numberOfLines={1}>
                  {item.goal}
                </Text>
              ) : null}
            </Pressable>
            {editing ? (
              <Pressable style={styles.deleteBtn} onPress={() => confirmDelete(item)} hitSlop={8}>
                <Text style={styles.deleteIcon}>🗑</Text>
              </Pressable>
            ) : null}
          </View>
        )}
        ListEmptyComponent={
          loading ? null : (
            <View style={styles.empty}>
              <ClaudeMascot size={88} color={colors.accent} />
              <Text style={styles.emptyText}>No projects yet.</Text>
              <Text style={styles.emptyHint}>
                A project gives a shared goal and context to a set of chats.
              </Text>
              <Pressable style={styles.cta} onPress={newProject}>
                <Text style={styles.ctaText}>Create a project</Text>
              </Pressable>
            </View>
          )
        }
      />

      <TouchableOpacity style={styles.fab} onPress={newProject} activeOpacity={0.85}>
        <Text style={styles.fabPlus}>＋</Text>
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const makeStyles = (c: Colors) =>
  StyleSheet.create({
    screen: { flex: 1, backgroundColor: c.bg },
    list: { padding: spacing.md, paddingBottom: 96 },
    emptyWrap: { flex: 1 },
    headerBtn: { color: c.accent, fontSize: 16, fontWeight: '600', paddingHorizontal: 4 },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: c.surface,
      borderRadius: radius.card,
      marginBottom: spacing.sm,
    },
    rowMain: { flex: 1, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
    rowTitle: { color: c.textStrong, fontSize: 16, fontWeight: '600' },
    rowSub: { color: c.textMuted, fontSize: 13, marginTop: 2 },
    deleteBtn: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, alignSelf: 'stretch', justifyContent: 'center' },
    deleteIcon: { fontSize: 18 },
    empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.lg },
    emptyText: { color: c.textFaint, fontSize: 15, textAlign: 'center' },
    emptyHint: { color: c.textMuted, fontSize: 13, textAlign: 'center', marginTop: -spacing.sm },
    cta: { backgroundColor: c.accent, borderRadius: radius.pill, paddingHorizontal: spacing.lg, paddingVertical: spacing.sm },
    ctaText: { color: c.textOnAccent, fontSize: 15, fontWeight: '600' },
    fab: {
      position: 'absolute',
      right: spacing.lg,
      bottom: spacing.lg,
      width: 56,
      height: 56,
      borderRadius: 28,
      backgroundColor: c.accent,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: '#000',
      shadowOpacity: 0.3,
      shadowRadius: 6,
      shadowOffset: { width: 0, height: 3 },
      elevation: 5,
    },
    fabPlus: { color: '#ffffff', fontSize: 32, fontWeight: '600', marginTop: -3 },
  });
