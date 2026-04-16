export const generateOrder = (name: string, value: 'asc' | 'desc' = 'asc') => {
  const fields = name.split('.');

  return fields.reduceRight((acc, field, index) => {
    if (index === fields.length - 1) {
      return { [field]: value };
    }
    return { [field]: acc };
  }, {});
};
