const subjectContainsChinese = ({ subject }) => {
  return [
    typeof subject === "string" && /\p{Script=Han}/u.test(subject),
    "冒号后的描述必须包含中文",
  ];
};

export default {
  extends: ["@commitlint/config-conventional"],
  plugins: [{ rules: { "subject-contains-chinese": subjectContainsChinese } }],
  rules: { "subject-contains-chinese": [2, "always"] },
};
