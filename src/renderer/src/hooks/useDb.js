import { useState, useEffect, useCallback } from 'react'

export function useDb(collection) {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const result = await window.api.db.get(collection)
    setData(result)
    setLoading(false)
  }, [collection])

  useEffect(() => {
    load()
  }, [load])

  const save = useCallback(
    async (newData) => {
      await window.api.db.save(collection, newData)
      setData(newData)
    },
    [collection]
  )

  const add = useCallback(
    async (item) => {
      const newData = [...data, item]
      await save(newData)
      return newData
    },
    [data, save]
  )

  const update = useCallback(
    async (id, changes) => {
      const newData = data.map((item) => (item.id === id ? { ...item, ...changes } : item))
      await save(newData)
      return newData
    },
    [data, save]
  )

  const remove = useCallback(
    async (id) => {
      const newData = data.filter((item) => item.id !== id)
      await save(newData)
      return newData
    },
    [data, save]
  )

  return { data, loading, reload: load, add, update, remove, save }
}
