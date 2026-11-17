import { redirect } from "react-router";

export const loader = async ({ request }) => {
  const url = new URL(request.url);
  // ������˭���ʸ�Ŀ¼��һ��ǿ�� 302 �׳��ض��� /app
  const search = url.searchParams.toString();
  return redirect(search ? `/app?${search}` : "/app");
};

export default function Index() {
  return null;
}
