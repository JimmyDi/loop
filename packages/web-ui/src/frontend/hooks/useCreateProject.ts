import { useEffect, useRef, useState } from "react";

import type { Project } from "../../shared/protocol";
import { useDirectoryPicker } from "./useDirectoryPicker";
import { useProjects } from "./useProjects";

export const useCreateProject = (onCreated: (project: Project) => void) => {
  const { add } = useProjects();
  const [name, setName] = useState("");
  const [path, setPath] = useState("");
  const nameInput = useRef<HTMLInputElement>(null);
  const selectFolder = (value: string) => {
    setPath(value);
    add.reset();
    nameInput.current?.focus();
  };
  const picker = useDirectoryPicker(selectFolder);
  const canCreate = Boolean(path) && !picker.picking && !add.isPending;

  useEffect(() => nameInput.current?.focus(), []);

  const changeName = (value: string) => {
    setName(value);
    add.reset();
  };
  const create = async () => {
    if (!canCreate) return;

    try {
      const project = await add.mutateAsync({ path, name: name.trim() || undefined });
      onCreated(project);
    } catch {
      /* Mutation exposes the error for retry. */
    }
  };

  return {
    name,
    path,
    nameInput,
    changeName,
    removeFolder: () => selectFolder(""),
    pickFolder: picker.pick,
    picking: picker.picking,
    saving: add.isPending,
    error: picker.error ?? add.error,
    canCreate,
    create,
  };
};
